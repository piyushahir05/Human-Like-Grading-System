"""
HLGS Grader — five-layer answer evaluation engine.
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

nltk.download("wordnet", quiet=True)
nltk.download("omw-1.4", quiet=True)

logger = logging.getLogger(__name__)

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
    "Remember": ["recall", "define", "list", "name", "identify", "describe", "recognize", "retrieve", "state", "repeat", "reproduce"],
    "Understand": ["explain", "summarize", "paraphrase", "illustrate", "clarify", "interpret", "classify", "discuss", "infer"],
    "Apply": ["use", "demonstrate", "implement", "execute", "solve", "apply", "calculate", "perform", "show", "utilize"],
    "Analyze": ["analyze", "compare", "differentiate", "examine", "break", "distinguish", "organize", "contrast", "deconstruct"],
    "Evaluate": ["evaluate", "judge", "justify", "assess", "critique", "defend", "argue", "recommend", "appraise", "measure"],
    "Create": ["create", "design", "develop", "construct", "produce", "compose", "generate", "plan", "build", "formulate"],
}

_BLOOM_SYSTEM_PROMPT = """You are an educational assessment expert specialising in Bloom's Taxonomy.
Classify the student's answer into one of the six Bloom's Taxonomy levels:

1. Remember (0.20): Retrieving relevant knowledge. Action verbs: recall, define, list, name, identify.
2. Understand (0.40): Constructing meaning from information. Action verbs: explain, summarize, paraphrase, interpret, classify.
3. Apply (0.60): Carrying out procedures in a given situation. Action verbs: use, demonstrate, solve, calculate, implement.
4. Analyze (0.75): Breaking material into parts and detecting relationships. Action verbs: analyze, compare, differentiate, examine, distinguish.
5. Evaluate (0.90): Making judgements based on criteria. Action verbs: evaluate, judge, justify, assess, critique, defend.
6. Create (1.00): Putting elements together to form a new whole. Action verbs: create, design, develop, construct, generate, plan.

Respond with valid JSON only. No extra text before or after. Use exactly these keys:
{"bloom_level": "Remember", "reasoning": "your reasoning here", "feedback": "your feedback here"}"""

_BLOOM_FEW_SHOT = """Example 1:
Question: What is the capital of France?
Answer: Paris is the capital of France.
Classification: {"bloom_level": "Remember", "reasoning": "Student recalls a fact.", "feedback": "Good recall! Try explaining why Paris is significant."}

Example 2:
Question: How does supply and demand affect prices?
Answer: When demand increases but supply stays constant, prices rise because buyers compete for limited goods.
Classification: {"bloom_level": "Analyze", "reasoning": "Student breaks down cause-effect relationships.", "feedback": "Excellent analysis! Add real-world examples to strengthen further."}

Now classify:
Question: {question}
Answer: {answer}
Classification:"""


class HLGSGrader:
    """Human-Like Grading System - five-layer answer evaluator."""

    def __init__(self, api_key: str, theme_dict: dict | None = None) -> None:
        self._sbert = SentenceTransformer("all-mpnet-base-v2")
        self._kw_model = KeyBERT(model=self._sbert)
        self._anthropic = anthropic.Anthropic(api_key=api_key)
        self._theme_dict: dict[str, list[str]] = theme_dict or {
            "Facts": ["fact", "information", "data", "evidence", "details"],
            "Leadership": ["leader", "leadership", "manage", "guide", "direct", "vision"],
            "Impact": ["impact", "effect", "result", "influence", "outcome", "consequence"],
        }

    def _layer1_preprocess(self, text: str) -> tuple[str, list[str], str]:
        devanagari_count = len(re.findall(r"[\u0900-\u097F]", text))
        language = "hi/mr" if devanagari_count > 5 else "en"
        text = text.lower()
        text = re.sub(r"[^\w\s\u0900-\u097F]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"(.)\1{2,}", r"\1\1", text)
        tokens = [t for t in text.split() if t not in STOPWORDS and len(t) >= 3]
        return text, tokens, language

    def _layer2_keyword(self, model_answer: str, student_tokens: list[str]) -> tuple[float, list[str], list[str]]:
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
            if keyword in student_token_set:
                found.append(keyword)
                continue
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

    def _layer3_semantic(self, clean_model: str, clean_student: str) -> float:
        embeddings = self._sbert.encode([clean_model, clean_student])
        sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        score = round(float(sim), 4)
        logger.info("Layer 3 (Semantic) score: %.4f", score)
        return score

    def _layer4_bloom(self, question: str, student_answer: str) -> tuple[str, float, str, str]:
        try:
            user_message = _BLOOM_FEW_SHOT.format(question=question, answer=student_answer)
            response = self._anthropic.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=512,
                temperature=0,
                system=_BLOOM_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            raw = response.content[0].text.strip()
            data = json.loads(raw)
            bloom_level_raw = data.get("bloom_level", "Remember")
            bloom_level = bloom_level_raw if bloom_level_raw in BLOOM_SCORE_MAP else "Remember"
            reasoning = data.get("reasoning", "")
            feedback = data.get("feedback", "")
            score = BLOOM_SCORE_MAP[bloom_level]
            print(f"BLOOM DETECTED: {bloom_level}")
            return bloom_level, score, reasoning, feedback
        except Exception as exc:
            print("BLOOM ERROR:", repr(exc))
            return self._bloom_fallback(student_answer)

    def _bloom_fallback(self, student_answer: str) -> tuple[str, float, str, str]:
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
        reasoning = f"Fallback detection: found {level_counts[best_level]} {best_level}-level verb(s)."
        feedback = "Consider using more precise academic language to demonstrate your level of understanding."
        logger.info("Layer 4 (Bloom/fallback) level: %s, score: %.4f", best_level, score)
        return best_level, score, reasoning, feedback

    def _layer5_theme_depth(self, student_answer: str, model_answer: str) -> tuple[float, list[str], list[str], float]:
        model_lower = model_answer.lower()
        student_lower = student_answer.lower()

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

        theme_score = len(covered_themes) / len(expected_themes) if expected_themes else 0.0
        word_count = max(len(student_answer.split()), 1)

        causal_pattern = r"\b(because|therefore|hence|thus|since|as a result|consequently|which led to|due to|owing to)\b"
        causal_hits = len(re.findall(causal_pattern, student_lower))
        causal_density = min(causal_hits / (word_count / 100), 1.0)

        clause_count = len(re.split(r"[,;:]", student_answer))
        argument_density = min(clause_count / (word_count / 100), 1.0)

        hedge_pattern = r"\b(possibly|arguably|could suggest|may indicate|in contrast|on the other hand|moreover|furthermore)\b"
        hedge_hits = len(re.findall(hedge_pattern, student_lower))
        hedge_density = min(hedge_hits / (word_count / 100), 1.0)

        depth_score = 0.45 * causal_density + 0.30 * argument_density + 0.25 * hedge_density
        combined = 0.70 * theme_score + 0.30 * depth_score
        logger.info("Layer 5 (Theme+Depth) score: %.4f", combined)
        return combined, covered_themes, missing_themes, depth_score

    def grade(self, question: str, model_answer: str, student_answer: str, weights: dict | None = None, max_marks: int = 10) -> dict:
        if weights is None:
            weights = {"keyword": 0.20, "semantic": 0.30, "bloom": 0.30, "theme": 0.20}

        clean_model, _model_tokens, _lang_model = self._layer1_preprocess(model_answer)
        clean_student, student_tokens, language = self._layer1_preprocess(student_answer)
        logger.info("Layer 1 (Preprocess) language detected: %s", language)

        keyword_score, keywords_found, keywords_missing = self._layer2_keyword(model_answer, student_tokens)
        semantic_score = self._layer3_semantic(clean_model, clean_student)
        bloom_level, bloom_score, bloom_reasoning, feedback = self._layer4_bloom(question, student_answer)
        theme_depth_score, themes_covered, themes_missing, depth_score = self._layer5_theme_depth(student_answer, model_answer)

        w1 = weights.get("keyword", 0.20)
        w2 = weights.get("semantic", 0.30)
        w3 = weights.get("bloom", 0.30)
        w4 = weights.get("theme", 0.20)

        raw_score = keyword_score * w1 + semantic_score * w2 + bloom_score * w3 + theme_depth_score * w4
        final_score = round(raw_score * max_marks, 1)
        percentage = round(final_score / max_marks * 100, 2)

        logger.info("Final score: %.1f / %d (%.2f%%)", final_score, max_marks, percentage)

        return {
            "final_score": final_score,
            "max_marks": max_marks,
            "percentage": percentage,
            "bloom_level": bloom_level,
            "bloom_raw_score": bloom_score,
            "bloom_reasoning": bloom_reasoning,
            "keyword_score": keyword_score,
            "semantic_score": semantic_score,
            "bloom_score": bloom_score,
            "theme_score": theme_depth_score,
            "keywords_found": keywords_found,
            "keywords_missing": keywords_missing,
            "themes_covered": themes_covered,
            "themes_missing": themes_missing,
            "depth_score": depth_score,
            "feedback": feedback,
            "language_detected": language,
            "weights_used": weights,
            "layers": {
                "keyword": keyword_score,
                "semantic": semantic_score,
                "bloom": bloom_score,
                "theme": theme_depth_score,
            },
        }