"""
HLGS FastAPI application.

Endpoints
---------
GET    /api/health          – health check
POST   /api/grade           – grade a student answer
GET    /api/results         – list grading records (filterable)
GET    /api/results/{id}    – fetch a single grading record
DELETE /api/results/{id}    – delete a grading record
GET    /api/stats           – aggregated statistics
GET    /api/export          – download all results as CSV
"""

import csv
import io
import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import models
from database import engine, get_db
from grader import HLGSGrader
from models import GradingResult
from schemas import GradeRequest, GradeResponse, LayerScores, StatsResponse

load_dotenv()

# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

_grader: HLGSGrader | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _grader
    models.Base.metadata.create_all(bind=engine)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    print("API KEY LOADED:", api_key[:20] if api_key else "NOT FOUND")  # add this
    _grader = HLGSGrader(api_key=api_key)
    yield


app = FastAPI(title="HLGS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper: build GradeResponse from a GradingResult ORM row
# ---------------------------------------------------------------------------


def _row_to_response(row: GradingResult) -> GradeResponse:
    return GradeResponse(
        id=row.id,
        student_name=row.student_name,
        subject=row.subject,
        question=row.question or "",
        model_answer=row.model_answer or "",
        student_answer=row.student_answer or "",
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


@app.get("/api/health")
def health_check() -> dict:
    """Return service health status."""
    return {"status": "ok", "models_loaded": True}


@app.post("/api/grade", response_model=GradeResponse)
def grade_answer(
    req: GradeRequest,
    db: Session = Depends(get_db),
) -> GradeResponse:
    """Grade a student answer and persist the result."""
    weights_sum = sum(req.weights.values())
    if abs(weights_sum - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Weights must sum to 1.0 (got {weights_sum:.4f})",
        )

    if _grader is None:
        raise HTTPException(status_code=500, detail="Grader is not initialised")

    try:
        result = _grader.grade(
            question=req.question,
            model_answer=req.model_answer,
            student_answer=req.student_answer,
            weights=req.weights,
            max_marks=req.max_marks,
        )
    except Exception as exc:
        import traceback
        traceback.print_exc()
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


@app.get("/api/results", response_model=list[GradeResponse])
def list_results(
    subject: Optional[str] = None,
    student_name: Optional[str] = None,
    min_score: Optional[float] = None,
    bloom_level: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[GradeResponse]:
    """Return grading records, newest first, with optional filters."""
    query = db.query(GradingResult)
    if subject is not None:
        query = query.filter(GradingResult.subject == subject)
    if student_name is not None:
        query = query.filter(GradingResult.student_name == student_name)
    if min_score is not None:
        query = query.filter(GradingResult.final_score >= min_score)
    if bloom_level is not None:
        query = query.filter(GradingResult.bloom_level == bloom_level)
    rows = query.order_by(GradingResult.graded_at.desc()).all()
    return [_row_to_response(r) for r in rows]


@app.get("/api/results/{result_id}", response_model=GradeResponse)
def get_result(result_id: str, db: Session = Depends(get_db)) -> GradeResponse:
    """Return a single grading record by id."""
    row = db.query(GradingResult).filter(GradingResult.id == result_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return _row_to_response(row)


@app.delete("/api/results/{result_id}")
def delete_result(result_id: str, db: Session = Depends(get_db)) -> dict:
    """Delete a grading record by id."""
    row = db.query(GradingResult).filter(GradingResult.id == result_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Result not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    """Return aggregated grading statistics."""
    rows = db.query(GradingResult).all()

    bloom_levels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]

    if not rows:
        return StatsResponse(
            total_graded=0,
            average_score=0.0,
            bloom_distribution={level: 0 for level in bloom_levels},
            average_per_layer={},
            score_distribution={"0-3": 0, "3-5": 0, "5-7": 0, "7-10": 0},
        )

    total = len(rows)
    avg_score = round(
        sum((r.final_score or 0.0) / (r.max_marks or 10) * 100 for r in rows) / total,
        2,
    )

    bloom_dist: dict[str, int] = {level: 0 for level in bloom_levels}
    for r in rows:
        lvl = r.bloom_level or "Remember"
        bloom_dist[lvl] = bloom_dist.get(lvl, 0) + 1

    avg_layers: dict[str, float] = {
        "keyword": round(sum(r.keyword_score or 0.0 for r in rows) / total, 4),
        "semantic": round(sum(r.semantic_score or 0.0 for r in rows) / total, 4),
        "bloom": round(sum(r.bloom_score or 0.0 for r in rows) / total, 4),
        "theme": round(sum(r.theme_score or 0.0 for r in rows) / total, 4),
    }

    score_dist: dict[str, int] = {"0-3": 0, "3-5": 0, "5-7": 0, "7-10": 0}
    for r in rows:
        score = r.final_score or 0.0
        if score < 3:
            score_dist["0-3"] += 1
        elif score < 5:
            score_dist["3-5"] += 1
        elif score < 7:
            score_dist["5-7"] += 1
        else:
            score_dist["7-10"] += 1

    return StatsResponse(
        total_graded=total,
        average_score=avg_score,
        bloom_distribution=bloom_dist,
        average_per_layer=avg_layers,
        score_distribution=score_dist,
    )


@app.get("/api/export")
def export_results(db: Session = Depends(get_db)) -> StreamingResponse:
    """Download all grading results as a CSV file."""
    header = [
        "id", "student_name", "subject", "question", "model_answer",
        "student_answer", "final_score", "max_marks", "percentage",
        "bloom_level", "bloom_raw_score", "keyword_score", "semantic_score",
        "bloom_score", "theme_score", "depth_score", "keywords_found",
        "keywords_missing", "themes_covered", "themes_missing",
        "feedback", "language_detected", "graded_at",
    ]

    def _row_to_csv_line(r: GradingResult) -> str:
        buf = io.StringIO()
        csv.writer(buf).writerow([
            r.id, r.student_name, r.subject, r.question, r.model_answer,
            r.student_answer, r.final_score, r.max_marks, r.percentage,
            r.bloom_level, r.bloom_raw_score, r.keyword_score, r.semantic_score,
            r.bloom_score, r.theme_score, r.depth_score,
            "|".join(r.keywords_found or []),
            "|".join(r.keywords_missing or []),
            "|".join(r.themes_covered or []),
            "|".join(r.themes_missing or []),
            r.feedback, r.language_detected, r.graded_at,
        ])
        return buf.getvalue()

    def _generate():
        hdr = io.StringIO()
        csv.writer(hdr).writerow(header)
        yield hdr.getvalue()
        for row in db.query(GradingResult).order_by(GradingResult.graded_at.desc()).yield_per(100):
            yield _row_to_csv_line(row)

    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hlgs_results.csv"},
    )
