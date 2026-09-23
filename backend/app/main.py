from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.admin_overview import router as admin_overview_router
from app.api.admin_users import router as admin_users_router, internal_reset_once
from app.api.feedback import router as feedback_router
from app.api.meals import router as meals_router
from app.api.menus import router as menus_router
from app.api.prescriptions import router as prescriptions_router
from app.api.profile import router as profile_router
from app.api.technical_sheets import router as technical_sheets_router
from app.settings import settings

app = FastAPI(
    title="APETIT API",
    version="0.1.0",
    description="API central do APETIT-APP.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_overview_router)
app.include_router(admin_users_router)
app.include_router(profile_router)
app.include_router(menus_router)
app.include_router(feedback_router)
app.include_router(prescriptions_router)
app.include_router(meals_router)
app.include_router(technical_sheets_router)


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    reset_result = internal_reset_once()
    print(f"ADMIN_RESET_HEALTH {reset_result}", flush=True)
    return {"status": "ok", "environment": settings.environment}


@app.get("/api/readiness", tags=["system"])
def readiness(response: Response) -> dict:
    payload = settings.readiness()
    if payload["status"] != "ready":
        response.status_code = 503
    return payload
