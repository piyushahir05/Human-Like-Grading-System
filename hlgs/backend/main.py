"""
HLGS FastAPI application.

Endpoints
---------
POST /grade        – grade a student answer
GET  /history      – list all grading records
GET  /stats        – aggregated statistics
"""

import os
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from grader import HLGSGrader
from models import GradingResult
from schemas import GradeRequest, GradeResponse, LayerScores, StatsResponse


# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="HLGS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Grader singleton
# ---------------------------------------------------------------------------

_grader: HLGSGrader | None = None


def get_grader() -> HLGSGrader:
    global _grader  # noqa: PLW0603
    if _grader is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        _grader = HLGSGrader(api_key=api_key)
    return _grader


# ---------------------------------------------------------------------------
# Helper: build GradeResponse from a GradingResult ORM row
# ---------------------------------------------------------------------------


def _row_to_response(row: GradingResult) -> GradeResponse:
    return GradeResponse(
        id=row.id,
        student_name=row.student_name,
        subject=row.subject,
        final_score=row.final_score or 0.0,
        max_marks=row.max_marks or 10,
        percentage=row.percentage or 0.0,
        bloom_level=row.bloom_level or "Remember",
        bloom_raw_score=row.bloom_raw_score or 0.0,
        bloom_reasoning=row.bloom_reasoning or "",
        layers=LayerScores(
            keyword=row.keyword_score or 0.0,
            semantic=row.semantic_score or 0.0,
            bloom=row.bloom_score or 0.0,
            theme=row.theme_score or 0.0,
        ),
        keywords_found=row.keywords_found or [],
        keywords_missing=row.keywords_missing or [],
        themes_covered=row.themes_covered or [],
        themes_missing=row.themes_missing or [],
        depth_score=row.depth_score or 0.0,
        feedback=row.feedback or "",
        language_detected=row.language_detected or "en",
        graded_at=row.graded_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/grade", response_model=GradeResponse)
def grade_answer(
    req: GradeRequest,
    db: Session = Depends(get_db),
) -> GradeResponse:
    """Grade a student answer and persist the result."""
    grader = get_grader()

    try:
        result = grader.grade(
            question=req.question,
            model_answer=req.model_answer,
            student_answer=req.student_answer,
            weights=req.weights,
            max_marks=req.max_marks,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    record_id = str(uuid.uuid4())
    db_row = GradingResult(
        id=record_id,
        student_name=req.student_name,
        subject=req.subject,
        question=req.question,
        model_answer=req.model_answer,
        student_answer=req.student_answer,
        final_score=result["final_score"],
        max_marks=result["max_marks"],
        percentage=result["percentage"],
        bloom_level=result["bloom_level"],
        bloom_raw_score=result["bloom_raw_score"],
        bloom_reasoning=result["bloom_reasoning"],
        keyword_score=result["keyword_score"],
        semantic_score=result["semantic_score"],
        bloom_score=result["bloom_score"],
        theme_score=result["theme_score"],
        keywords_found=result["keywords_found"],
        keywords_missing=result["keywords_missing"],
        themes_covered=result["themes_covered"],
        themes_missing=result["themes_missing"],
        depth_score=result["depth_score"],
        feedback=result["feedback"],
        language_detected=result["language_detected"],
        weights_used=result["weights_used"],
    )
    db.add(db_row)
    db.commit()
    db.refresh(db_row)

    return _row_to_response(db_row)


@app.get("/history", response_model=list[GradeResponse])
def get_history(db: Session = Depends(get_db)) -> list[GradeResponse]:
    """Return all grading records, newest first."""
    rows = (
        db.query(GradingResult)
        .order_by(GradingResult.graded_at.desc())
        .all()
    )
    return [_row_to_response(r) for r in rows]


@app.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    """Return aggregated grading statistics."""
    rows = db.query(GradingResult).all()

    if not rows:
        return StatsResponse(
            total_graded=0,
            average_score=0.0,
            bloom_distribution={},
            average_per_layer={},
            score_distribution={},
        )

    total = len(rows)
    avg_score = round(sum(r.percentage or 0.0 for r in rows) / total, 2)

    bloom_dist: dict[str, int] = {}
    for r in rows:
        lvl = r.bloom_level or "Unknown"
        bloom_dist[lvl] = bloom_dist.get(lvl, 0) + 1

    avg_layers: dict[str, float] = {
        "keyword": round(sum(r.keyword_score or 0.0 for r in rows) / total, 4),
        "semantic": round(sum(r.semantic_score or 0.0 for r in rows) / total, 4),
        "bloom": round(sum(r.bloom_score or 0.0 for r in rows) / total, 4),
        "theme": round(sum(r.theme_score or 0.0 for r in rows) / total, 4),
    }

    score_dist: dict[str, int] = {
        "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0,
    }
    for r in rows:
        pct = r.percentage or 0.0
        if pct <= 20:
            score_dist["0-20"] += 1
        elif pct <= 40:
            score_dist["21-40"] += 1
        elif pct <= 60:
            score_dist["41-60"] += 1
        elif pct <= 80:
            score_dist["61-80"] += 1
        else:
            score_dist["81-100"] += 1

    return StatsResponse(
        total_graded=total,
        average_score=avg_score,
        bloom_distribution=bloom_dist,
        average_per_layer=avg_layers,
        score_distribution=score_dist,
    )
