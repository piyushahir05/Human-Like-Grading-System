import re

with open("grader.py", "r") as f:
    content = f.read()

new_method = '''    def _layer4_bloom(self, question: str, student_answer: str) -> tuple[str, float, str, str]:
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
            raw = raw.replace(\'\\\\"\', \'"\')
            bloom_level = "Remember"
            for level in BLOOM_SCORE_MAP.keys():
                if level.lower() in raw.lower():
                    bloom_level = level
                    break
            reasoning_match = re.search(r\'reasoning[^:]*:[^"]*"([^"]+)"\', raw)
            feedback_match = re.search(r\'feedback[^:]*:[^"]*"([^"]+)"\', raw)
            reasoning = reasoning_match.group(1) if reasoning_match else ""
            feedback = feedback_match.group(1) if feedback_match else ""
            score = BLOOM_SCORE_MAP[bloom_level]
            print(f"BLOOM DETECTED: {bloom_level}")
            return bloom_level, score, reasoning, feedback
        except Exception as exc:
            print("BLOOM ERROR:", repr(exc))
            return self._bloom_fallback(student_answer)
'''

content = re.sub(
    r'    def _layer4_bloom.*?return self\._bloom_fallback\(student_answer\)',
    new_method.rstrip(),
    content,
    flags=re.DOTALL
)

with open("grader.py", "w") as f:
    f.write(content)

print("Done! grader.py patched successfully.")