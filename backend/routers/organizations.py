from typing import Optional
from collections import defaultdict
import httpx

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Organization, User, UserOrganizationLink, Branch, Device
from utils.organization_types import (
    get_organization_type_choices,
    get_organization_type_label,
    normalize_organization_type,
)

router = APIRouter()


def _get_organization_user_counts(db: Session, org_ids: list[int]) -> dict[int, int]:
    if not org_ids:
        return {}

    user_ids_by_org: dict[int, set[int]] = defaultdict(set)
    linked_user_ids: set[int] = set()

    for row in (
        db.query(UserOrganizationLink.user_id, UserOrganizationLink.organization_id)
        .filter(UserOrganizationLink.organization_id.in_(org_ids))
        .all()
    ):
        if row.organization_id is None or row.user_id is None:
            continue
        org_id = int(row.organization_id)
        user_id = int(row.user_id)
        user_ids_by_org[org_id].add(user_id)
        linked_user_ids.add(user_id)

    for user_id, org_id in (
        db.query(User.id, User.organization_id)
        .filter(User.organization_id.in_(org_ids))
        .filter(User.is_staff == True)
        .all()
    ):
        if user_id is None or org_id is None:
            continue
        safe_user_id = int(user_id)
        if safe_user_id in linked_user_ids:
            continue
        user_ids_by_org[int(org_id)].add(safe_user_id)

    return {org_id: len(user_ids) for org_id, user_ids in user_ids_by_org.items()}


class OrganizationCreate(BaseModel):
    name: str
    organization_type: Optional[str] = None
    default_start_time: Optional[str] = "09:00"
    default_end_time: Optional[str] = "18:00"
    address: Optional[str] = None
    phone: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = 100.0


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    organization_type: Optional[str] = None
    default_start_time: Optional[str] = None
    default_end_time: Optional[str] = None
    subscription_status: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None


class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = 100.0


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None


def _serialize_branch(b: Branch) -> dict:
    has_devices = len(b.devices) > 0
    is_online = any(d.is_online for d in b.devices) if has_devices else True
    return {
        "id": b.id,
        "uuid": b.uuid,
        "organization_id": b.organization_id,
        "name": b.name,
        "address": b.address,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "radius": b.radius,
        "devices_count": len(b.devices),
        "status": "online" if is_online else "offline",
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


@router.get("/api/organizations/types")
def list_organization_types(lang: str = Query("uz")):
    return get_organization_type_choices(lang=lang)


@router.get("/api/organizations")
def list_organizations(
    lang: str = Query("uz"),
    db: Session = Depends(get_db),
):
    orgs = db.query(Organization).order_by(Organization.id).all()
    org_ids = [int(o.id) for o in orgs]
    users_count_by_org = _get_organization_user_counts(db, org_ids)
    return [
        {
            "id": o.id,
            "uuid": o.uuid,
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
            "address": o.address,
            "phone": o.phone,
            "region": o.region,
            "district": o.district,
            "village": o.village,
            "latitude": o.latitude,
            "longitude": o.longitude,
            "radius": o.radius,
            "users_count": int(users_count_by_org.get(int(o.id), 0)),
            "employees_count": len(o.employees),
            "devices_count": len(o.devices),
            "branches_count": len(o.branches),
            "branches": [_serialize_branch(b) for b in o.branches],
        }
        for o in orgs
    ]


@router.get("/api/organizations/{org_id}")
def get_organization(
    org_id: str,
    lang: str = Query("uz"),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    return {
        "id": org.id,
        "uuid": org.uuid,
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
        "address": org.address,
        "phone": org.phone,
        "region": org.region,
        "district": org.district,
        "village": org.village,
        "latitude": org.latitude,
        "longitude": org.longitude,
        "radius": org.radius,
        "branches": [_serialize_branch(b) for b in org.branches],
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
        address=data.address,
        phone=data.phone,
        region=data.region,
        district=data.district,
        village=data.village,
        latitude=data.latitude,
        longitude=data.longitude,
        radius=data.radius,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"ok": True, "id": org.id, "message": "Tashkilot yaratildi"}


@router.put("/api/organizations/{org_id}")
def update_organization(org_id: str, data: OrganizationUpdate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
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
    if data.address is not None:
        org.address = data.address
    if data.phone is not None:
        org.phone = data.phone
    if data.region is not None:
        org.region = data.region
    if data.district is not None:
        org.district = data.district
    if data.village is not None:
        org.village = data.village
    if data.latitude is not None:
        org.latitude = data.latitude
    if data.longitude is not None:
        org.longitude = data.longitude
    if data.radius is not None:
        org.radius = data.radius

    db.commit()
    return {"ok": True, "message": "Tashkilot yangilandi"}


@router.delete("/api/organizations/{org_id}")
def delete_organization(org_id: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    db.delete(org)
    db.commit()
    return {"ok": True, "message": "Tashkilot o'chirildi"}


# ─── Branch (Filial) CRUD ────────────────────────────────────────────────────

@router.get("/api/organizations/{org_id}/branches")
def list_branches(org_id: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    branches = db.query(Branch).filter(Branch.organization_id == org.id).order_by(Branch.id).all()
    return [_serialize_branch(b) for b in branches]


@router.get("/api/organizations/{org_id}/branches/{branch_id}")
def get_branch_detail(
    org_id: str,
    branch_id: str,
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    branch = db.query(Branch).filter(Branch.uuid == branch_id, Branch.organization_id == org.id).first()
    if not branch and branch_id.isdigit():
        branch = db.query(Branch).filter(Branch.id == int(branch_id), Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Filial topilmadi")
        
    # Cameras (all cameras belonging to this organization)
    from models import Device
    org_devices_list = db.query(Device).filter(Device.organization_id == org.id).order_by(Device.id).all()
    devices = [{
        "id": d.id,
        "name": d.name,
        "mac_address": d.mac_address,
        "isup_device_id": d.isup_device_id,
        "model": d.model,
        "is_online": d.is_online,
        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "branch_id": d.branch_id,
        "branch_name": d.branch.name if d.branch else None,
    } for d in org_devices_list]
    
    # Employees (Xodimlar va O'quvchilar)
    employees = [{
        "id": e.id,
        "first_name": e.first_name,
        "last_name": e.last_name,
        "middle_name": e.middle_name,
        "personal_id": e.personal_id,
        "phone": e.phone,
        "employee_type": e.employee_type,  # "hodim", "oquvchi", vb.
        "department": e.department_ref.name if e.department_ref else e.department,
        "position": e.position_ref.name if e.position_ref else e.position,
    } for e in branch.employees]
    
    # System Users (Tizim foydalanuvchilari)
    users = db.query(User).filter(User.branch_id == branch.id).filter(User.is_staff == True).all()
    serialized_users = [{
        "id": u.id,
        "name": u.name,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role.value if u.role else "",
        "status": u.status,
    } for u in users]
    
    return {
        "ok": True,
        "org_uuid": org.uuid,
        "branch": _serialize_branch(branch),
        "devices": devices,
        "employees": employees,
        "users": serialized_users,
    }


@router.post("/api/organizations/{org_id}/branches")
def create_branch(org_id: str, data: BranchCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    name = str(data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Filial nomi majburiy")
    branch = Branch(
        organization_id=org.id,
        name=name,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
        radius=data.radius,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return {"ok": True, "id": branch.id, "branch": _serialize_branch(branch)}


@router.put("/api/organizations/{org_id}/branches/{branch_id}")
def update_branch(org_id: str, branch_id: str, data: BranchUpdate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    branch = db.query(Branch).filter(Branch.uuid == branch_id, Branch.organization_id == org.id).first()
    if not branch and branch_id.isdigit():
        branch = db.query(Branch).filter(Branch.id == int(branch_id), Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Filial topilmadi")
    if data.name is not None:
        name = str(data.name or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Filial nomi majburiy")
        branch.name = name
    if data.address is not None:
        branch.address = data.address
    if data.latitude is not None:
        branch.latitude = data.latitude
    if data.longitude is not None:
        branch.longitude = data.longitude
    if data.radius is not None:
        branch.radius = data.radius
    from utils.time_utils import now_tashkent
    branch.updated_at = now_tashkent()
    db.commit()
    db.refresh(branch)
    return {"ok": True, "branch": _serialize_branch(branch)}


@router.delete("/api/organizations/{org_id}/branches/{branch_id}")
def delete_branch(org_id: str, branch_id: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.uuid == org_id).first()
    if not org and org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    branch = db.query(Branch).filter(Branch.uuid == branch_id, Branch.organization_id == org.id).first()
    if not branch and branch_id.isdigit():
        branch = db.query(Branch).filter(Branch.id == int(branch_id), Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Filial topilmadi")
    # Kameralardan filial bog'liqligini olib tashlash
    db.query(Device).filter(Device.branch_id == branch.id).update({"branch_id": None})
    db.delete(branch)
    db.commit()
    return {"ok": True, "message": "Filial o'chirildi"}


def normalize_base_name(name: str) -> str:
    name_lower = name.lower()
    suffixes = [" viloyati", " viloyat", " shahri", " shahari", " tumani", " tuman", " mfy", " mahallasi", " mahalla"]
    for s in suffixes:
        name_lower = name_lower.replace(s, "")
    return name_lower.strip()


def clean_display_name(data: dict) -> str:
    if not data:
        return ""
    address = data.get("address")
    if not address:
        display_name = data.get("display_name") or ""
        parts = [p.strip() for p in display_name.split(",") if p.strip()]
        cleaned_parts = []
        for p in parts:
            p_lower = p.lower()
            if p_lower in ("o'zbekiston", "oʻzbekiston", "uzbekistan"):
                continue
            if p.isdigit():
                continue
            if p not in cleaned_parts:
                cleaned_parts.append(p)
        return ", ".join(cleaned_parts)
    
    # Extract fields
    road = address.get("road") or address.get("street") or address.get("square") or address.get("path")
    neighbourhood = address.get("neighbourhood") or address.get("suburb") or address.get("residential") or address.get("quarter")
    city = address.get("city") or address.get("town") or address.get("village") or address.get("hamlet") or address.get("city_district")
    county = address.get("county") or address.get("district")
    state = address.get("state") or address.get("province")

    parts = []
    
    if road:
        parts.append(str(road).strip())
        
    if neighbourhood:
        n_str = str(neighbourhood).strip()
        if n_str.endswith(" mahallasi"):
            n_str = n_str[:-10].strip() + " MFY"
        elif n_str.endswith(" mahalla"):
            n_str = n_str[:-8].strip() + " MFY"
        elif n_str.endswith(" MFY"):
            pass
        elif "mahalla" in n_str.lower():
            n_str = n_str.replace("mahallasi", "").replace("mahalla", "").strip() + " MFY"
        parts.append(n_str)
        
    if city:
        parts.append(str(city).strip())
        
    if county:
        co_str = str(county).strip()
        co_base = normalize_base_name(co_str)
        city_base = normalize_base_name(city or "")
        if co_base != city_base:
            if co_str.endswith(" Tumani"):
                co_str = co_str[:-7].strip() + " tumani"
            elif co_str.endswith(" tumani"):
                pass
            parts.append(co_str)
            
    if state:
        st_str = str(state).strip()
        st_base = normalize_base_name(st_str)
        city_base = normalize_base_name(city or "")
        county_base = normalize_base_name(county or "")
        if st_base != city_base and st_base != county_base:
            if st_str.endswith(" viloyati"):
                pass
            elif st_str.endswith(" Viloyati"):
                st_str = st_str[:-9].strip() + " viloyati"
            parts.append(st_str)

    seen = set()
    unique_parts = []
    for p in parts:
        p_clean = p.strip()
        p_lower = p_clean.lower()
        if p_clean and p_lower not in seen:
            seen.add(p_lower)
            unique_parts.append(p_clean)
            
    return ", ".join(unique_parts)


@router.get("/api/organizations/geo/reverse")
async def geo_reverse(lat: float, lon: float, lang: str = "uz"):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "format": "json",
        "lat": lat,
        "lon": lon,
        "zoom": 18,
        "addressdetails": 1,
    }
    headers = {
        "User-Agent": "BioFaceApp/1.0 (info@bioface.uz)",
        "Accept-Language": lang
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                data["display_name"] = clean_display_name(data)
                return data
            else:
                raise HTTPException(status_code=resp.status_code, detail="Nominatim API error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geo lookup failed: {str(e)}")


@router.get("/api/organizations/geo/search")
async def geo_search(q: str, limit: int = 5, lang: str = "uz"):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "format": "json",
        "q": q,
        "limit": limit,
        "countrycodes": "uz",
        "addressdetails": 1,
    }
    headers = {
        "User-Agent": "BioFaceApp/1.0 (info@bioface.uz)",
        "Accept-Language": lang
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                results = resp.json()
                for item in results:
                    item["display_name"] = clean_display_name(item)
                return results
            else:
                raise HTTPException(status_code=resp.status_code, detail="Nominatim API error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geo search failed: {str(e)}")


@router.get("/api/branches")
def list_branches_authorized(
    request: Request,
    org: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    from routers.employees_parts.common import resolve_allowed_org_ids
    allowed_org_ids = resolve_allowed_org_ids(request, db) or []
    if not allowed_org_ids:
        return []
    
    if org is not None:
        if org not in allowed_org_ids:
            raise HTTPException(status_code=403, detail="Tashkilotga kirishga ruxsat yo'q")
        filter_org_ids = [org]
    else:
        filter_org_ids = allowed_org_ids

    branches = db.query(Branch).filter(Branch.organization_id.in_(filter_org_ids)).order_by(Branch.id).all()
    org_names = {o.id: o.name for o in db.query(Organization.id, Organization.name).filter(Organization.id.in_(filter_org_ids)).all()}
    
    result = []
    for b in branches:
        serialized = _serialize_branch(b)
        serialized["organization_name"] = org_names.get(b.organization_id, "")
        result.append(serialized)
    return result


@router.get("/api/public/branches")
def list_public_branches(db: Session = Depends(get_db)):
    branches = db.query(Branch).order_by(Branch.id).all()
    org_ids = list({b.organization_id for b in branches if b.organization_id is not None})
    org_names = {}
    if org_ids:
        org_names = {o.id: o.name for o in db.query(Organization.id, Organization.name).filter(Organization.id.in_(org_ids)).all()}
    
    result = []
    for b in branches:
        serialized = _serialize_branch(b)
        serialized["organization_name"] = org_names.get(b.organization_id, "")
        result.append(serialized)
    return result

