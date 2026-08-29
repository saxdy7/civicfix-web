from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

IssueCategory = Literal["pothole", "garbage", "streetlight", "other"]
IssueStatus = Literal[
    "reported",
    "triaged",
    "duplicate",
    "assigned",
    "in_progress",
    "pending_verification",
    "resolved",
    "reopened",
    "rejected",
]
IssueSeverity = Literal["low", "medium", "high", "critical"]
IssuePriority = Literal["low", "medium", "high", "critical"]


class CreateIssueRequest(BaseModel):
    category: IssueCategory
    description: str = Field(min_length=10, max_length=2000)
    severity: IssueSeverity = "medium"
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    neighborhood: Optional[str] = None
    landmark: Optional[str] = None
    storage_key: Optional[str] = None
    mime_type: Optional[str] = None
    checksum: Optional[str] = None


class IssueEventSchema(BaseModel):
    id: str
    status: IssueStatus
    note: Optional[str] = None
    created_at: datetime


class IssueResponse(BaseModel):
    id: str
    tracking_id: str
    category: IssueCategory
    status: IssueStatus
    severity: IssueSeverity
    priority: IssuePriority
    description: str
    neighborhood: str
    latitude: float
    longitude: float
    created_at: datetime
    updated_at: datetime
    department_name: Optional[str] = None
    ai_suggested_category: Optional[str] = None
    ai_confidence: Optional[float] = None
    events: list[IssueEventSchema] = []


class TriageAssessment(BaseModel):
    suggested_category: IssueCategory
    suggested_severity: IssueSeverity
    suggested_department: str
    confidence: float
    reasoning: str
    is_duplicate: bool = False
    duplicate_issue_id: Optional[str] = None
    duplicate_tracking_id: Optional[str] = None


class ChatMessageRequest(BaseModel):
    message: str
    photo_url: Optional[str] = None
    user_id: Optional[str] = None


class DailyAuditReport(BaseModel):
    run_id: str
    executed_at: datetime
    status_integrity_passed: bool
    sla_breaches_count: int
    missing_evidence_count: int
    duplicate_clusters_count: int
    unresolved_critical_count: int
    findings: list[dict] = []
