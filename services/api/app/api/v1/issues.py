import random
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas.issue import CreateIssueRequest, IssueResponse, IssueCategory, IssueStatus
from app.services.ai_triage import triage_civic_issue

router = APIRouter(prefix="/issues", tags=["Issues"])

MOCK_STORE = [
    {
        "id": "iss-1",
        "tracking_id": "CF-10234",
        "category": "pothole",
        "status": "in_progress",
        "severity": "high",
        "priority": "high",
        "description": "Deep pothole in the eastbound lane near intersection.",
        "neighborhood": "Maple & 5th",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "created_at": datetime.fromisoformat("2026-08-20T14:12:00Z"),
        "updated_at": datetime.fromisoformat("2026-08-25T09:00:00Z"),
        "department_name": "Streets & Roads",
        "ai_suggested_category": "pothole",
        "ai_confidence": 0.94,
        "events": [
            {"id": "e1", "status": "reported", "created_at": datetime.fromisoformat("2026-08-20T14:12:00Z")},
            {"id": "e2", "status": "triaged", "note": "Confirmed by photo", "created_at": datetime.fromisoformat("2026-08-21T10:00:00Z")},
            {"id": "e3", "status": "assigned", "note": "Routed to Streets & Roads", "created_at": datetime.fromisoformat("2026-08-22T08:30:00Z")},
            {"id": "e4", "status": "in_progress", "created_at": datetime.fromisoformat("2026-08-25T09:00:00Z")},
        ],
    },
    {
        "id": "iss-2",
        "tracking_id": "CF-10198",
        "category": "garbage",
        "status": "pending_verification",
        "severity": "medium",
        "priority": "medium",
        "description": "Overflowing dumpster behind community center.",
        "neighborhood": "Riverside Park",
        "latitude": 37.7690,
        "longitude": -122.4102,
        "created_at": datetime.fromisoformat("2026-08-18T11:00:00Z"),
        "updated_at": datetime.fromisoformat("2026-08-24T16:40:00Z"),
        "department_name": "Sanitation",
        "ai_suggested_category": "garbage",
        "ai_confidence": 0.88,
        "events": [
            {"id": "e1", "status": "reported", "created_at": datetime.fromisoformat("2026-08-18T11:00:00Z")},
            {"id": "e2", "status": "triaged", "created_at": datetime.fromisoformat("2026-08-19T09:00:00Z")},
            {"id": "e3", "status": "assigned", "created_at": datetime.fromisoformat("2026-08-19T15:00:00Z")},
            {"id": "e4", "status": "in_progress", "created_at": datetime.fromisoformat("2026-08-22T09:00:00Z")},
            {"id": "e5", "status": "pending_verification", "note": "Field evidence submitted", "created_at": datetime.fromisoformat("2026-08-24T16:40:00Z")},
        ],
    },
]


@router.get("", response_model=list[IssueResponse])
async def list_issues(
    category: Optional[IssueCategory] = Query(None),
    status: Optional[IssueStatus] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    results = MOCK_STORE
    if category:
        results = [i for i in results if i["category"] == category]
    if status:
        results = [i for i in results if i["status"] == status]
    return results[:limit]


@router.post("", response_model=IssueResponse, status_code=201)
async def create_issue(payload: CreateIssueRequest):
    # Run AI triage
    triage = await triage_civic_issue(
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )

    new_id = f"iss-{len(MOCK_STORE) + 1}"
    tracking_id = f"CF-{random.randint(10000, 99999)}"
    now = datetime.utcnow()

    new_issue = {
        "id": new_id,
        "tracking_id": tracking_id,
        "category": payload.category,
        "status": "reported",
        "severity": payload.severity,
        "priority": payload.severity,
        "description": payload.description,
        "neighborhood": payload.neighborhood or "Civic District",
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "created_at": now,
        "updated_at": now,
        "department_name": triage.suggested_department,
        "ai_suggested_category": triage.suggested_category,
        "ai_confidence": triage.confidence,
        "events": [
            {
                "id": f"e-{random.randint(100, 999)}",
                "status": "reported",
                "note": "Submitted by citizen",
                "created_at": now,
            }
        ],
    }

    MOCK_STORE.append(new_issue)
    return new_issue


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: str):
    for iss in MOCK_STORE:
        if iss["id"] == issue_id or iss["tracking_id"].lower() == issue_id.lower():
            return iss
    raise HTTPException(status_code=404, detail="Issue not found")
