import os
import random
import re
import threading
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from models import (
    Device,
    Employee,
    EmployeeCameraLink,
    EmployeePsychologicalState,
    Organization,
    UserOrganizationLink,
)
from routers.cameras_parts.psychology_utils import (
    build_psychological_profile,
    deserialize_emotion_scores,
    state_labels,
)

UPLOAD_DIR = "static/uploads/employees"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ISUP_SNAPSHOT_INDEX_PATH = os.path.join("static", "uploads", "isup", "_employee_snapshot_index.json")

PERSONAL_ID_PATTERN = re.compile(r"^[1-9]\d{6}$")
EMPLOYEE_TYPES = {"oquvchi", "oqituvchi", "hodim"}
WELLBEING_NOTE_SOURCES = {"manual", "operator_observation", "self_report"}
PSYCHOLOGICAL_STATE_SOURCES = {"manual", "psychologist_assessment", "questionnaire", "external_system"}

_IMPORT_JOBS_LOCK = threading.Lock()
_IMPORT_JOBS: dict[str, dict[str, Any]] = {}


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def normalize_employee_type_for_import(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in EMPLOYEE_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Xodim turi noto'g'ri. Faqat: oquvchi, oqituvchi, hodim",
        )
    return raw


def resolve_allowed_org_ids(request: Request, db: Session) -> list[int]:
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    if role in {"superadmin", "super_admin"}:
        rows = db.query(Organization.id).all()
        return [int(row.id) for row in rows]

    org_ids: set[int] = set()
    user_id = auth_user.get("id")
    has_linked_orgs = False
    if user_id is not None:
        rows = (
            db.query(UserOrganizationLink.organization_id)
            .filter(UserOrganizationLink.user_id == int(user_id))
            .all()
        )
        org_ids.update(int(row.organization_id) for row in rows if row.organization_id is not None)
        has_linked_orgs = bool(org_ids)
    fallback_org_id = auth_user.get("organization_id")
    if not has_linked_orgs and fallback_org_id is not None:
        org_ids.add(int(fallback_org_id))
    return sorted(org_ids)


def get_accessible_organization_or_raise(request: Request, db: Session, organization_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == int(organization_id)).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    allowed_org_ids = resolve_allowed_org_ids(request, db)
    if allowed_org_ids and int(org.id) not in allowed_org_ids:
        raise HTTPException(status_code=403, detail="Bu tashkilotga ruxsat yo'q")
    if not allowed_org_ids:
        auth_user = request.session.get("auth_user") or {}
        role = str(auth_user.get("role") or "").strip().lower()
        if role not in {"superadmin", "super_admin"}:
            raise HTTPException(status_code=403, detail="Bu tashkilotga ruxsat yo'q")
    return org


def get_organization_or_raise(db: Session, organization_id: Optional[int]) -> Optional[Organization]:
    if organization_id is None:
        return None
    org = db.query(Organization).filter(Organization.id == int(organization_id)).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    return org


def resolve_effective_org_id(request: Request, db: Session, organization_id: Optional[int]) -> Optional[int]:
    if organization_id is not None:
        org = get_accessible_organization_or_raise(request, db, int(organization_id))
        return int(org.id)

    allowed_org_ids = resolve_allowed_org_ids(request, db)
    if len(allowed_org_ids) == 1:
        return int(allowed_org_ids[0])
    return None


def set_import_job(job_id: str, payload: dict[str, Any]) -> None:
    with _IMPORT_JOBS_LOCK:
        _IMPORT_JOBS[job_id] = payload


def update_import_job(job_id: str, **changes: Any) -> dict[str, Any]:
    with _IMPORT_JOBS_LOCK:
        state = dict(_IMPORT_JOBS.get(job_id) or {})
        state.update(changes)
        _IMPORT_JOBS[job_id] = state
        return state


def get_import_job(job_id: str) -> Optional[dict[str, Any]]:
    with _IMPORT_JOBS_LOCK:
        state = _IMPORT_JOBS.get(job_id)
        return dict(state) if state else None


def normalize_personal_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def validate_personal_id_format(personal_id: str) -> None:
    if not PERSONAL_ID_PATTERN.fullmatch(personal_id):
        raise HTTPException(
            status_code=422,
            detail="Shaxsiy ID 7 ta raqam bo'lishi kerak va 0 bilan boshlanmasligi kerak",
        )


def is_personal_id_taken(
    db: Session,
    personal_id: str,
    *,
    exclude_employee_id: Optional[int] = None,
) -> bool:
    query = db.query(Employee.id).filter(Employee.personal_id == personal_id)
    if exclude_employee_id is not None:
        query = query.filter(Employee.id != exclude_employee_id)
    return query.first() is not None


def generate_unique_personal_id(db: Session, max_attempts: int = 5000) -> str:
    for _ in range(max_attempts):
        candidate = str(random.randint(1000000, 9999999))
        if not is_personal_id_taken(db, candidate):
            return candidate
    raise HTTPException(status_code=503, detail="Unikal Shaxsiy ID generatsiya qilib bo'lmadi")


def normalize_employee_type(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in EMPLOYEE_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Xodim turi noto'g'ri. Faqat: oquvchi, oqituvchi, hodim",
        )
    return raw


def normalize_wellbeing_note_source(value: Optional[str]) -> str:
    source = str(value or "manual").strip().lower() or "manual"
    if source not in WELLBEING_NOTE_SOURCES:
        raise HTTPException(status_code=422, detail="source noto'g'ri")
    return source


def normalize_psychological_state_source(value: Optional[str]) -> str:
    source = str(value or "manual").strip().lower() or "manual"
    if source not in PSYCHOLOGICAL_STATE_SOURCES:
        raise HTTPException(status_code=422, detail="source noto'g'ri")
    return source


def normalize_state_label_text(value: Optional[str]) -> str:
    return str(value or "").strip().casefold().replace("yo'q", "yoq")


def infer_state_key_from_labels(state_uz: Optional[str], state_ru: Optional[str]) -> Optional[str]:
    normalized_uz = normalize_state_label_text(state_uz)
    normalized_ru = normalize_state_label_text(state_ru)
    for key in (
        "angry",
        "disgust",
        "fear",
        "happy",
        "neutral",
        "sad",
        "surprise",
        "contempt",
        "missing_image",
        "undetermined",
    ):
        label_uz, label_ru = state_labels(key)
        if normalized_uz and normalized_uz == normalize_state_label_text(label_uz):
            return key
        if normalized_ru and normalized_ru == normalize_state_label_text(label_ru):
            return key
    return None


def serialize_psychological_state_row(row: EmployeePsychologicalState) -> dict[str, Any]:
    inferred_state_key = str(row.state_key or infer_state_key_from_labels(row.state_uz, row.state_ru) or "").strip()
    emotion_scores = deserialize_emotion_scores(row.emotion_scores_json)
    profile = build_psychological_profile(
        inferred_state_key,
        confidence=row.confidence,
        emotion_scores=emotion_scores,
    )
    return {
        "id": int(row.id),
        "employee_id": int(row.employee_id),
        "state_key": inferred_state_key or profile.get("state_key"),
        "state_uz": row.state_uz,
        "state_ru": row.state_ru,
        "state_date": row.state_date,
        "source": row.source,
        "note": row.note,
        "confidence": row.confidence,
        "emotion_scores": emotion_scores,
        "profile_text_uz": profile.get("profile_text_uz"),
        "profile_text_ru": profile.get("profile_text_ru"),
        "top_emotions_uz": profile.get("top_emotions_uz"),
        "top_emotions_ru": profile.get("top_emotions_ru"),
        "assessed_at": row.assessed_at.isoformat() if row.assessed_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def parse_camera_ids(raw: Optional[str]) -> list[int]:
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []

    if text.startswith("["):
        import json

        try:
            payload = json.loads(text)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="camera_ids formati noto'g'ri") from exc
    else:
        payload = [x.strip() for x in text.split(",") if x.strip()]

    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="camera_ids ro'yxat bo'lishi kerak")

    normalized: list[int] = []
    seen: set[int] = set()
    for item in payload:
        try:
            cam_id = int(str(item).strip())
        except Exception:
            continue
        if cam_id <= 0 or cam_id in seen:
            continue
        seen.add(cam_id)
        normalized.append(cam_id)
    return normalized


def save_employee_camera_links(
    db: Session,
    *,
    employee_id: int,
    camera_ids: list[int],
    organization_id: Optional[int],
) -> list[int]:
    if not camera_ids:
        db.query(EmployeeCameraLink).filter(EmployeeCameraLink.employee_id == employee_id).delete(
            synchronize_session=False
        )
        return []

    cameras = db.query(Device).filter(Device.id.in_(camera_ids)).all()
    camera_map = {int(c.id): c for c in cameras}
    valid_ids: list[int] = []
    for cam_id in camera_ids:
        cam = camera_map.get(cam_id)
        if cam is None:
            continue
        if organization_id is not None and cam.organization_id != organization_id:
            continue
        valid_ids.append(cam_id)

    offline_cameras = [camera_map[cam_id] for cam_id in valid_ids if not bool(camera_map[cam_id].is_online)]
    if offline_cameras:
        offline_names = ", ".join(str(cam.name or f"#{cam.id}") for cam in offline_cameras[:5])
        if len(offline_cameras) > 5:
            offline_names += ", ..."
        raise HTTPException(
            status_code=422,
            detail=f"Offline kameraga foydalanuvchi saqlab bo'lmaydi: {offline_names}",
        )

    db.query(EmployeeCameraLink).filter(EmployeeCameraLink.employee_id == employee_id).delete(
        synchronize_session=False
    )

    for cam_id in valid_ids:
        db.add(EmployeeCameraLink(employee_id=employee_id, camera_id=cam_id))
    return valid_ids


def resolve_employee_target_cameras(
    db: Session,
    *,
    employee: Employee,
    camera_id: Optional[int] = None,
    camera_ids: Optional[list[int]] = None,
) -> list[Device]:
    requested_ids = [int(cid) for cid in (camera_ids or []) if int(cid) > 0]
    if camera_id is not None and int(camera_id) > 0:
        requested_ids = [int(camera_id)] + [cid for cid in requested_ids if cid != int(camera_id)]

    if requested_ids:
        cameras = db.query(Device).filter(Device.id.in_(requested_ids)).all()
        cam_map = {int(cam.id): cam for cam in cameras}
        return [cam_map[cid] for cid in requested_ids if cid in cam_map]

    linked_camera_ids = [
        int(row.camera_id)
        for row in db.query(EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id == employee.id)
        .all()
        if row.camera_id is not None
    ]
    if linked_camera_ids:
        cameras = db.query(Device).filter(Device.id.in_(linked_camera_ids)).all()
        cam_map = {int(cam.id): cam for cam in cameras}
        return [cam_map[cid] for cid in linked_camera_ids if cid in cam_map]

    cams_q = db.query(Device)
    if employee.organization_id is not None:
        cams_q = cams_q.filter(Device.organization_id == employee.organization_id)
    return cams_q.order_by(Device.id.asc()).all()
