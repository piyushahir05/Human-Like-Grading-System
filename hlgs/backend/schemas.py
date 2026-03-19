from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GradeRequest(BaseModel):
    question: str
    model_answer: str
    student_answer: str
    student_name: str
    subject: str
    weights: dict = Field(
        default_factory=lambda: {
            "keyword": 0.20,
            "semantic": 0.30,
            "bloom": 0.30,
            "theme": 0.20,
        }
    )
    max_marks: int = 10
    theme_dict: Optional[dict] = None


class LayerScores(BaseModel):
    keyword: float
    semantic: float
    bloom: float
    theme: float


class GradeResponse(BaseModel):
    id: str
    student_name: str
    subject: str
    question: str
    model_answer: str
    student_answer: str
    final_score: float
    max_marks: int
    percentage: float
    bloom_level: str
    bloom_raw_score: float
    bloom_reasoning: str
    layers: LayerScores
    keywords_found: list[str]
    keywords_missing: list[str]
    themes_covered: list[str]
    themes_missing: list[str]
    depth_score: float
    feedback: str
    language_detected: str
    graded_at: datetime


class StatsResponse(BaseModel):
    total_graded: int
    average_score: float
    bloom_distribution: dict[str, int]
    average_per_layer: dict[str, float]
    score_distribution: dict[str, int]
