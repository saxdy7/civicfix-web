# CivicFix API

FastAPI domain API. Owns protected workflow transitions, role/scope decisions, AI orchestration,
and PostGIS queries. See [`../../spec/ARCHITECTURE.md`](../../spec/ARCHITECTURE.md).

## Local development

```bash
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -e ".[dev]"
cp .env.example .env    # fill in Convex/Clerk/Groq/FCM values
uvicorn app.main:app --reload --port 8000
```

Health check: `GET /v1/health`

## Tests

```bash
pytest
```
