"""Employee unit authorization and audited administrative assignment."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.admin_auth import AdminPrincipal, require_admin, require_permission
from app.db import engine

router = APIRouter()


def require_employee_unit(person: dict, unit_id: UUID | None) -> UUID:
    assigned = person.get("unit_id")
    if assigned is None or unit_id is None or str(assigned) != str(unit_id):
        raise HTTPException(
            status_code=403, detail="Acesso permitido somente à sua unidade vinculada."
        )
    return UUID(str(assigned))


class EmployeeUnitAssignment(BaseModel):
    unit_id: UUID


@router.get("/api/admin/employees", tags=["admin-employees"])
def list_employees(
    q: str = Query(default="", max_length=120),
    unassigned: bool = False,
    offset: int = Query(default=0, ge=0, le=100000),
    limit: int = Query(default=25, ge=1, le=100),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_users")
    params = {"q": q.strip(), "unassigned": unassigned, "offset": offset, "limit": limit + 1}
    with engine.connect() as conn:
        rows = (
            conn.execute(
                text("""
            SELECT p.id,p.name,p.email,p.unit_id,u.name AS unit_name,c.name AS company_name
            FROM people p
            LEFT JOIN units u ON u.id=p.unit_id
            LEFT JOIN companies c ON c.id=u.company_id
            WHERE p.deleted_at IS NULL
              AND (NOT :unassigned OR p.unit_id IS NULL)
              AND (:q='' OR strpos(lower(coalesce(p.name,'')),lower(:q))>0
                   OR strpos(lower(coalesce(p.email::text,'')),lower(:q))>0)
            ORDER BY p.name NULLS LAST,p.id
            OFFSET :offset LIMIT :limit
        """),
                params,
            )
            .mappings()
            .all()
        )
    return {"employees": [dict(row) for row in rows[:limit]], "has_more": len(rows) > limit}


@router.get("/api/admin/employees/unit-options", tags=["admin-employees"])
def employee_unit_options(principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    with engine.connect() as conn:
        rows = (
            conn.execute(
                text("""
            SELECT u.id,u.name,c.name AS company_name
            FROM units u JOIN companies c ON c.id=u.company_id
            ORDER BY c.name,u.name,u.id
        """)
            )
            .mappings()
            .all()
        )
    return {"units": [dict(row) for row in rows]}


@router.put("/api/admin/employees/{person_id}/unit", tags=["admin-employees"])
def assign_employee_unit(
    person_id: UUID,
    payload: EmployeeUnitAssignment,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_users")
    with engine.begin() as conn:
        person = (
            conn.execute(
                text("""
            SELECT unit_id FROM people WHERE id=:id AND deleted_at IS NULL FOR UPDATE
        """),
                {"id": person_id},
            )
            .mappings()
            .one_or_none()
        )
        if person is None:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado.")
        if (
            conn.execute(
                text("SELECT 1 FROM units WHERE id=:id"), {"id": payload.unit_id}
            ).scalar_one_or_none()
            is None
        ):
            raise HTTPException(status_code=422, detail="Unidade não encontrada.")
        conn.execute(
            text("UPDATE people SET unit_id=:unit WHERE id=:id"),
            {"unit": payload.unit_id, "id": person_id},
        )
        conn.execute(
            text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,unit_id,metadata)
            VALUES (:actor,'employee.unit_assigned','employee',:person,:unit,CAST(:metadata AS jsonb))
        """),
            {
                "actor": principal.id,
                "person": str(person_id),
                "unit": payload.unit_id,
                "metadata": json.dumps(
                    {"previous_unit_id": str(person["unit_id"]) if person["unit_id"] else None}
                ),
            },
        )
    return {"status": "saved", "person_id": str(person_id), "unit_id": str(payload.unit_id)}
