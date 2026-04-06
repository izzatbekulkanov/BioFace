from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Organization
from organization_types import (
    get_organization_type_choices,
    get_organization_type_label,
    normalize_organization_type,
)

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str
    organization_type: Optional[str] = None
    default_start_time: Optional[str] = "09:00"
    default_end_time: Optional[str] = "18:00"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    organization_type: Optional[str] = None
    default_start_time: Optional[str] = None
    default_end_time: Optional[str] = None
    subscription_status: Optional[str] = None


@router.get("/api/organizations/types")
def list_organization_types(lang: str = Query("uz")):
    return get_organization_type_choices(lang=lang)


@router.get("/api/organizations")
def list_organizations(
    lang: str = Query("uz"),
    db: Session = Depends(get_db),
):
    orgs = db.query(Organization).order_by(Organization.id).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "organization_type": normalize_organization_type(o.organization_type),
            "organization_type_label": get_organization_type_label(o.organization_type, lang=lang),
            "subscription_status": (
                o.subscription_status.value
                if hasattr(o.subscription_status, "value")
                else str(o.subscription_status or "")
            ),
            "subscription_end_date": o.subscription_end_date.isoformat() if o.subscription_end_date else None,
            "default_start_time": o.default_start_time,
            "default_end_time": o.default_end_time,
            "users_count": len(o.users),
            "employees_count": len(o.employees),
            "devices_count": len(o.devices),
        }
        for o in orgs
    ]


@router.get("/api/organizations/{org_id}")
def get_organization(
    org_id: int,
    lang: str = Query("uz"),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    return {
        "id": org.id,
        "name": org.name,
        "organization_type": normalize_organization_type(org.organization_type),
        "organization_type_label": get_organization_type_label(org.organization_type, lang=lang),
        "subscription_status": (
            org.subscription_status.value
            if hasattr(org.subscription_status, "value")
            else str(org.subscription_status or "")
        ),
        "subscription_end_date": org.subscription_end_date.isoformat() if org.subscription_end_date else None,
        "default_start_time": org.default_start_time,
        "default_end_time": org.default_end_time,
    }


@router.post("/api/organizations")
def create_organization(data: OrganizationCreate, db: Session = Depends(get_db)):
    name = str(data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Tashkilot nomi majburiy")

    org = Organization(
        name=name,
        organization_type=normalize_organization_type(data.organization_type),
        default_start_time=data.default_start_time,
        default_end_time=data.default_end_time,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"ok": True, "id": org.id, "message": "Tashkilot yaratildi"}


@router.put("/api/organizations/{org_id}")
def update_organization(org_id: int, data: OrganizationUpdate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    if data.name is not None:
        name = str(data.name or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Tashkilot nomi majburiy")
        org.name = name
    if data.organization_type is not None:
        org.organization_type = normalize_organization_type(data.organization_type)
    if data.default_start_time is not None:
        org.default_start_time = data.default_start_time
    if data.default_end_time is not None:
        org.default_end_time = data.default_end_time
    if data.subscription_status is not None:
        org.subscription_status = data.subscription_status

    db.commit()
    return {"ok": True, "message": "Tashkilot yangilandi"}


@router.delete("/api/organizations/{org_id}")
def delete_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    db.delete(org)
    db.commit()
    return {"ok": True, "message": "Tashkilot o'chirildi"}
