from fastapi import FastAPI

from app.settings import settings

app = FastAPI(
    title="APETIT API",
    version="0.1.0",
    description="API central do APETIT-APP.",
)


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
