from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.schemas.issue import TriageAssessment
from app.services.ai_triage import triage_civic_issue

router = APIRouter(prefix="/triage", tags=["Triage & AI"])


class TriageRequest(BaseModel):
    description: str
    photo_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/analyze", response_model=TriageAssessment)
async def analyze_report(payload: TriageRequest):
    return await triage_civic_issue(
        description=payload.description,
        photo_url=payload.photo_url,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
