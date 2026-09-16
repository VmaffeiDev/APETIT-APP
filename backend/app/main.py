from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.menus import router as menus_router
from app.settings import settings

app = FastAPI(
    title="APETIT API",
    version="0.1.0",
    description="API central do APETIT-APP.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menus_router)


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
