"""
HLGS Grader — five-layer answer evaluation engine.

Layers
------
1. Preprocessing   – clean text, detect language, tokenise
2. Keyword Scoring – KeyBERT extraction + WordNet synonym matching
3. Semantic Sim    – SentenceTransformer cosine similarity
4. Bloom's Level   – Claude API classification with verb-count fallback
5. Theme & Depth   – theme coverage + causal/argument/hedge density
"""

import json
import logging
import re

import anthropic
import nltk
from keybert import KeyBERT
from nltk.corpus import wordnet
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Download required NLTK corpora once at import time
nltk.download("wordnet", quiet=True)
nltk.download("omw-1.4", quiet=True)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# 75 common English stopwords (satisfies the ≥60 requirement)
STOPWORDS: set[str] = {
    "a", "an", "the", "and", "or", "but", "nor", "so", "yet",
    "both", "either", "neither", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "into", "through", "before", "after",
    "about", "over", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "that", "this", "these",
    "those", "it", "its", "they", "their", "them", "he", "she", "we",
    "you", "i", "my", "our", "your", "his", "her", "not", "no", "as",
    "than", "then", "also", "just", "very",
}

BLOOM_SCORE_MAP: dict[str, float] = {
    "Remember": 0.20,
    "Understand": 0.40,
    "Apply": 0.60,
    "Analyze": 0.75,
    "Evaluate": 0.90,
    "Create": 1.00,
}

BLOOM_VERBS: dict[str, list[str]] = {
    "Remember": [
        "recall", "define", "list", "name", "identify",
        "describe", "recognize", "retrieve", "state", "repeat", "reproduce",
    ],
    "Understand": [
        "explain", "summarize", "paraphrase", "illustrate", "clarify",
        "interpret", "classify", "discuss", "infer",
    ],
    "Apply": [
        "use", "demonstrate", "implement", "execute", "solve",
        "apply", "calculate", "perform", "show", "utilize",
    ],
    "Analyze": [
        "analyze", "compare", "differentiate", "examine", "break",
        "distinguish", "organize", "contrast", "deconstruct",
    ],
    "Evaluate": [
        "evaluate", "judge", "justify", "assess", "critique",
        "defend", "argue", "recommend", "appraise", "measure",
    ],
    "Create": [
        "create", "design", "develop", "construct", "produce",
        "compose", "generate", "plan", "build", "formulate",
    ],
}

_BLOOM_SYSTEM_PROMPT = """You are an educational assessment expert specialising in Bloom's Taxonomy. \
Classify the student's answer into one of the six Bloom's Taxonomy levels:

1. Remember (0.20): Retrieving relevant knowledge. Action verbs: recall, define, list, name, identify.
   Example: "Photosynthesis is the process by which plants make food using sunlight."

2. Understand (0.40): Constructing meaning from information. Action verbs: explain, summarize, paraphrase, interpret, classify.
   Example: "Photosynthesis converts CO2 and water into glucose using light energy."

3. Apply (0.60): Carrying out procedures in a given situation. Action verbs: use, demonstrate, solve, calculate, implement.
   Example: "We can use the photosynthesis equation to calculate glucose produced given a CO2 intake."

4. Analyze (0.75): Breaking material into parts and detecting relationships. Action verbs: analyze, compare, differentiate, examine, distinguish.
   Example: "Comparing C3 and C4 photosynthesis reveals that C4 plants have adapted to minimise photorespiration."

5. Evaluate (0.90): Making judgements based on criteria. Action verbs: evaluate, judge, justify, assess, critique, defend.
   Example: "The Calvin cycle is more efficient than the light reactions because it produces more stable products per unit of energy."

6. Create (1.00): Putting elements together to form a new whole. Action verbs: create, design, develop, construct, generate, plan.
   Example: "Designing a bioengineered plant with enhanced photosynthesis efficiency by combining C4 pathways with improved light-harvesting proteins."

Respond with JSON only: {"bloom_level": "<level>", "reasoning": "<brief reasoning>", "feedback": "<constructive feedback>"}"""

_BLOOM_FEW_SHOT = """Here are two classification examples:

Example 1:
Question: What is the capital of France?
Answer: Paris is the capital of France. It has been the capital since the 10th century.
Classification: {"bloom_level": "Remember", "reasoning": "The student simply recalls a factual piece of information without explanation or analysis.", "feedback": "Good recall! To improve, try explaining why Paris became the capital or discuss its historical significance."}

Example 2:
Question: How does supply and demand affect prices?
Answer: When analysing the interplay between supply and demand, we can see that price equilibrium is disrupted when one factor changes faster than the other. For instance, when demand increases but supply stays constant, sellers can charge more because buyers compete for limited goods. Conversely, excess supply drives prices down. This relationship shows that price is not arbitrary but emerges from the tension between these two market forces.
Classification: {"bloom_level": "Analyze", "reasoning": "The student breaks down the relationship between supply and demand, examines how changes in each component affect equilibrium, and distinguishes between different scenarios.", "feedback": "Excellent analysis! You could strengthen this further by evaluating specific real-world examples or discussing policy implications."}

Now classify the following:
Question: {question}
Answer: {answer}
Classification:"""


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class HLGSGrader:
    """Human-Like Grading System — five-layer answer evaluator."""

    def __init__(self, api_key: str, theme_dict: dict | None = None) -> None:
        # Load SentenceTransformer once; also used as KeyBERT backend
        self._sbert = SentenceTransformer("all-mpnet-base-v2")
        self._kw_model = KeyBERT(model=self._sbert)
        self._anthropic = anthropic.Anthropic(api_key=api_key)
        self._theme_dict: dict[str, list[str]] = theme_dict or {
            "Facts": ["fact", "information", "data", "evidence", "details"],
            "Leadership": ["leader", "leadership", "manage", "guide", "direct", "vision"],
            "Impact": ["impact", "effect", "result", "influence", "outcome", "consequence"],
        }

    # ------------------------------------------------------------------
    # Layer 1 — Preprocessing
    # ------------------------------------------------------------------

    def _layer1_preprocess(self, text: str) -> tuple[str, list[str], str]:
        """Clean text, detect language, tokenise and remove stopwords."""
        # Language detection on raw text (before case folding)
        devanagari_count = len(re.findall(r"[\u0900-\u097F]", text))
        language = "hi/mr" if devanagari_count > 5 else "en"

        # Lowercase
        text = text.lower()
        # Remove punctuation (preserve word chars, whitespace, Devanagari)
        text = re.sub(r"[^\w\s\u0900-\u097F]", " ", text)
        # Normalise whitespace
        text = re.sub(r"\s+", " ", text).strip()
        # Collapse repeated characters (e.g. "sooooo" → "soo")
        text = re.sub(r"(.)\1{2,}", r"\1\1", text)

        # Tokenise: split on whitespace, remove stopwords and short tokens
        tokens = [t for t in text.split() if t not in STOPWORDS and len(t) >= 3]

        return text, tokens, language

    # ------------------------------------------------------------------
    # Layer 2 — Keyword Scoring
    # ------------------------------------------------------------------

    def _layer2_keyword(
        self,
        model_answer: str,
        student_tokens: list[str],
    ) -> tuple[float, list[str], list[str]]:
        """Extract keywords from model answer and score student coverage."""
        raw_keywords = self._kw_model.extract_keywords(
            model_answer,
            keyphrase_ngram_range=(1, 1),
            stop_words="english",
            top_n=10,
        )
        keyword_list: list[str] = [kw[0] for kw in raw_keywords]

        student_token_set = set(student_tokens)
        found: list[str] = []
        missing: list[str] = []

        for keyword in keyword_list:
            # a) Exact match
            if keyword in student_token_set:
                found.append(keyword)
                continue

            # b) Synonym match via WordNet
            synset_lemmas: set[str] = set()
            for synset in wordnet.synsets(keyword):
                for lemma in synset.lemma_names():
                    synset_lemmas.add(lemma.lower().replace("_", " "))

            if synset_lemmas & student_token_set:
                found.append(keyword)
            else:
                missing.append(keyword)

        score = len(found) / len(keyword_list) if keyword_list else 0.0
        logger.info("Layer 2 (Keyword) score: %.4f", score)
        return score, found, missing

    # ------------------------------------------------------------------
    # Layer 3 — Semantic Similarity
    # ------------------------------------------------------------------

    def _layer3_semantic(self, clean_model: str, clean_student: str) -> float:
        """Cosine similarity between SentenceTransformer embeddings."""
        embeddings = self._sbert.encode([clean_model, clean_student])
        sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        score = round(float(sim), 4)
        logger.info("Layer 3 (Semantic) score: %.4f", score)
        return score

    # ------------------------------------------------------------------
    # Layer 4 — Bloom's Level
    # ------------------------------------------------------------------

    def _layer4_bloom(
        self, question: str, student_answer: str
    ) -> tuple[str, float, str, str]:
        """Classify Bloom's taxonomy level via Claude with verb-count fallback."""
        user_message = _BLOOM_FEW_SHOT.format(
            question=question, answer=student_answer
        )
        try:
            response = self._anthropic.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=512,
                temperature=0,
                system=_BLOOM_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences if present
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

            data = json.loads(raw)
            bloom_level: str = data.get("bloom_level", "Remember")
            reasoning: str = data.get("reasoning", "")
            feedback: str = data.get("feedback", "")

            if bloom_level not in BLOOM_SCORE_MAP:
                bloom_level = "Remember"

            score = BLOOM_SCORE_MAP[bloom_level]
            logger.info("Layer 4 (Bloom) level: %s, score: %.4f", bloom_level, score)
            return bloom_level, score, reasoning, feedback

        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Bloom API call failed (%s); falling back to verb counting.", exc
            )
            return self._bloom_fallback(student_answer)

    def _bloom_fallback(
        self, student_answer: str
    ) -> tuple[str, float, str, str]:
        """Fallback: count Bloom action-verb occurrences per level."""
        text_lower = student_answer.lower()
        level_counts: dict[str, int] = {level: 0 for level in BLOOM_VERBS}

        for level, verbs in BLOOM_VERBS.items():
            for verb in verbs:
                if re.search(r"\b" + re.escape(verb) + r"\b", text_lower):
                    level_counts[level] += 1

        best_level = max(level_counts, key=level_counts.get)
        if level_counts[best_level] == 0:
            best_level = "Remember"

        score = BLOOM_SCORE_MAP[best_level]
        reasoning = (
            f"Fallback detection: found {level_counts[best_level]} "
            f"{best_level}-level verb(s)."
        )
        feedback = (
            "Consider using more precise academic language to demonstrate "
            "your level of understanding."
        )
        logger.info(
            "Layer 4 (Bloom/fallback) level: %s, score: %.4f", best_level, score
        )
        return best_level, score, reasoning, feedback

    # ------------------------------------------------------------------
    # Layer 5 — Theme & Depth
    # ------------------------------------------------------------------

    def _layer5_theme_depth(
        self,
        student_answer: str,
        model_answer: str,
    ) -> tuple[float, list[str], list[str], float]:
        """Score theme coverage and answer depth."""
        model_lower = model_answer.lower()
        student_lower = student_answer.lower()

        # Only evaluate themes whose keywords appear in the model answer
        expected_themes = [
            theme
            for theme, kws in self._theme_dict.items()
            if any(kw.lower() in model_lower for kw in kws)
        ]
        if not expected_themes:
            expected_themes = list(self._theme_dict.keys())

        covered_themes: list[str] = []
        missing_themes: list[str] = []
        for theme in expected_themes:
            kws = self._theme_dict[theme]
            if any(kw.lower() in student_lower for kw in kws):
                covered_themes.append(theme)
            else:
                missing_themes.append(theme)

        theme_score = (
            len(covered_themes) / len(expected_themes) if expected_themes else 0.0
        )

        # --- Depth sub-scores ---
        word_count = max(len(student_answer.split()), 1)

        # Causal density (weight 0.45)
        causal_pattern = (
            r"\b(because|therefore|hence|thus|since|as a result|consequently"
            r"|which led to|due to|owing to)\b"
        )
        causal_hits = len(re.findall(causal_pattern, student_lower))
        causal_density = min(causal_hits / (word_count / 100), 1.0)

        # Argument density (weight 0.30): clause segments per 100 words
        clause_count = len(re.split(r"[,;:]", student_answer))
        argument_density = min(clause_count / (word_count / 100), 1.0)

        # Hedge language (weight 0.25)
        hedge_pattern = (
            r"\b(possibly|arguably|could suggest|may indicate|in contrast"
            r"|on the other hand|moreover|furthermore)\b"
        )
        hedge_hits = len(re.findall(hedge_pattern, student_lower))
        hedge_density = min(hedge_hits / (word_count / 100), 1.0)

        depth_score = (
            0.45 * causal_density
            + 0.30 * argument_density
            + 0.25 * hedge_density
        )

        combined = 0.70 * theme_score + 0.30 * depth_score
        logger.info(
            "Layer 5 (Theme+Depth) score: %.4f  (theme=%.4f, depth=%.4f)",
            combined,
            theme_score,
            depth_score,
        )
        return combined, covered_themes, missing_themes, depth_score

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def grade(
        self,
        question: str,
        model_answer: str,
        student_answer: str,
        weights: dict | None = None,
        max_marks: int = 10,
    ) -> dict:
        """Run all five layers and return a flat result dict.

        The returned dict contains every field needed to populate a
        ``GradingResult`` DB row plus a ``layers`` sub-dict for
        ``GradeResponse``.
        """
        if weights is None:
            weights = {"keyword": 0.20, "semantic": 0.30, "bloom": 0.30, "theme": 0.20}

        # Layer 1 — Preprocessing
        clean_model, _model_tokens, _lang_model = self._layer1_preprocess(model_answer)
        clean_student, student_tokens, language = self._layer1_preprocess(student_answer)
        logger.info("Layer 1 (Preprocess) language detected: %s", language)

        # Layer 2 — Keyword scoring
        keyword_score, keywords_found, keywords_missing = self._layer2_keyword(
            model_answer, student_tokens
        )

        # Layer 3 — Semantic similarity
        semantic_score = self._layer3_semantic(clean_model, clean_student)

        # Layer 4 — Bloom's level
        bloom_level, bloom_score, bloom_reasoning, feedback = self._layer4_bloom(
            question, student_answer
        )

        # Layer 5 — Theme & depth
        theme_depth_score, themes_covered, themes_missing, depth_score = (
            self._layer5_theme_depth(student_answer, model_answer)
        )

        # Score aggregation
        w1 = weights.get("keyword", 0.20)
        w2 = weights.get("semantic", 0.30)
        w3 = weights.get("bloom", 0.30)
        w4 = weights.get("theme", 0.20)

        raw_score = (
            keyword_score * w1
            + semantic_score * w2
            + bloom_score * w3
            + theme_depth_score * w4
        )
        final_score = round(raw_score * max_marks, 1)
        percentage = round(final_score / max_marks * 100, 2)

        logger.info(
            "Final score: %.1f / %d (%.2f%%)", final_score, max_marks, percentage
        )

        return {
            # Core scores
            "final_score": final_score,
            "max_marks": max_marks,
            "percentage": percentage,
            # Bloom
            "bloom_level": bloom_level,
            "bloom_raw_score": bloom_score,
            "bloom_reasoning": bloom_reasoning,
            # Layer scores (flat, for GradingResult columns)
            "keyword_score": keyword_score,
            "semantic_score": semantic_score,
            "bloom_score": bloom_score,
            "theme_score": theme_depth_score,
            # Keywords
            "keywords_found": keywords_found,
            "keywords_missing": keywords_missing,
            # Themes
            "themes_covered": themes_covered,
            "themes_missing": themes_missing,
            # Depth
            "depth_score": depth_score,
            # Metadata
            "feedback": feedback,
            "language_detected": language,
            "weights_used": weights,
            # Nested layer scores (for GradeResponse)
            "layers": {
                "keyword": keyword_score,
                "semantic": semantic_score,
                "bloom": bloom_score,
                "theme": theme_depth_score,
            },
        }
