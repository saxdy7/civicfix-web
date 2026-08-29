import json
from typing import Optional
import httpx
from app.core.config import get_settings
from app.schemas.issue import IssueCategory, IssueSeverity, TriageAssessment

settings = get_settings()

DEPARTMENT_MAP: dict[IssueCategory, str] = {
    "pothole": "Streets & Roads",
    "garbage": "Sanitation",
    "streetlight": "Public Lighting & Electrical",
    "other": "General Public Works",
}


async def triage_civic_issue(
    description: str,
    photo_url: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> TriageAssessment:
    # 1. Try Groq API if API key is provided
    if settings.groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                prompt = (
                    f"You are an AI civic triage assistant. Analyze this resident complaint:\n"
                    f"\"{description}\"\n\n"
                    f"Return ONLY valid JSON with keys: category ('pothole'|'garbage'|'streetlight'|'other'), "
                    f"severity ('low'|'medium'|'high'|'critical'), confidence (float between 0 and 1), and reasoning (short sentence)."
                )
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    content = json.loads(data["choices"][0]["message"]["content"])
                    cat: IssueCategory = content.get("category", "other")
                    sev: IssueSeverity = content.get("severity", "medium")
                    conf: float = float(content.get("confidence", 0.9))
                    reason: str = content.get("reasoning", "Analyzed via Groq LLM.")
                    return TriageAssessment(
                        suggested_category=cat,
                        suggested_severity=sev,
                        suggested_department=DEPARTMENT_MAP.get(cat, "General Public Works"),
                        confidence=conf,
                        reasoning=reason,
                    )
        except Exception:
            pass  # Fall back to heuristic classification

    # 2. Heuristic Rule-Based Triage
    lower = description.lower()
    cat: IssueCategory = "other"
    if any(w in lower for w in ["pothole", "road", "asphalt", "crater", "sinkhole", "pavement"]):
        cat = "pothole"
    elif any(w in lower for w in ["garbage", "trash", "dump", "litter", "waste", "dumpster", "overflow"]):
        cat = "garbage"
    elif any(w in lower for w in ["streetlight", "light", "lamp", "dark", "pole", "bulb"]):
        cat = "streetlight"

    sev: IssueSeverity = "medium"
    if any(w in lower for w in ["danger", "hazard", "immediate", "emergency", "fatal", "deep", "blocked"]):
        sev = "high"
    elif any(w in lower for w in ["minor", "cosmetic", "small"]):
        sev = "low"

    return TriageAssessment(
        suggested_category=cat,
        suggested_severity=sev,
        suggested_department=DEPARTMENT_MAP.get(cat, "General Public Works"),
        confidence=0.88,
        reasoning="Heuristically triaged via civic keyword parser.",
    )
