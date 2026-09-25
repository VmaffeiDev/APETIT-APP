from fastapi import APIRouter, Header

from app.api.auth import OnboardingPayload, me, save_onboarding

router = APIRouter()


@router.put("/api/me", tags=["employee-profile"])
def update_me(
    payload: OnboardingPayload,
    authorization: str | None = Header(default=None),
) -> dict:
    save_onboarding(payload, authorization)
    return me(authorization)
