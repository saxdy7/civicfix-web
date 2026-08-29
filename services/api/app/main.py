from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.triage import router as triage_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="CivicFix AI Adapter API",
    description="Optional AI adapter service for CivicFix. Convex is the canonical database and workflow engine.",
    version="1.0.0",
    root_path="",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/v1")
app.include_router(triage_router, prefix="/v1")

