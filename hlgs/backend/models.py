from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Text

from database import Base


class GradingResult(Base):
    __tablename__ = "grading_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    student_name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    model_answer = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=False)
    final_score = Column(Float)
    max_marks = Column(Integer, default=10)
    percentage = Column(Float)
    bloom_level = Column(String)
    bloom_raw_score = Column(Float)
    bloom_reasoning = Column(Text)
    keyword_score = Column(Float)
    semantic_score = Column(Float)
    bloom_score = Column(Float)
    theme_score = Column(Float)
    keywords_found = Column(JSON)
    keywords_missing = Column(JSON)
    themes_covered = Column(JSON)
    themes_missing = Column(JSON)
    depth_score = Column(Float)
    feedback = Column(Text)
    language_detected = Column(String, default="en")
    weights_used = Column(JSON)
    graded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
