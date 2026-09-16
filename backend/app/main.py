from fastapi import FastAPI

from app.api.menus import router as menus_router
from app.settings import settings

app = FastAPI(
    title="APETIT API",
    version="0.1.0",
    description="API central do APETIT-APP.",
)

app.include_router(menus_router)


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
