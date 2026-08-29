from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "CivicFix AI Adapter",
        "canonical_backend": "convex",
        "ai_engine": "groq" if settings.groq_api_key else "heuristic",
    }
