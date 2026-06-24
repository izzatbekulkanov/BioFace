from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Feedback, Employee, UserOrganizationLink, Organization

router = APIRouter(prefix="/api/feedbacks", tags=["Feedbacks API"])

# ── Pydantic schemas ─────────────────────────────────────────────────────────

class FeedbackSubmit(BaseModel):
    employee_id: Optional[int] = None
    title: Optional[str] = None
    message: str

class FeedbackOut(BaseModel):
    id: int
    uuid: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    employee_personal_id: Optional[str] = None
    organization_name: Optional[str] = None
    title: Optional[str] = None
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/submit", status_code=201)
def submit_feedback(data: FeedbackSubmit, db: Session = Depends(get_db)):
    employee = None
    emp_id = None
    if data.employee_id is not None:
        employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
        if not employee:
            employee = db.query(Employee).filter(Employee.personal_id == str(data.employee_id)).first()
        if employee:
            emp_id = employee.id

    fb = Feedback(
        employee_id=emp_id,
        title=data.title,
        message=data.message,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"ok": True, "message": "Feedback submitted successfully"}

@router.get("", response_model=List[FeedbackOut])
def list_feedbacks(request: Request, db: Session = Depends(get_db)):
    auth_user = request.session.get("auth_user") or {}
    if not auth_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    role = str(auth_user.get("role") or "").strip().lower()
    is_super_admin = role in {"superadmin", "super_admin"}
    
    feedbacks_query = db.query(Feedback)
    
    if not is_super_admin:
        allowed_org_ids = set()
        user_id = auth_user.get("id")
        if user_id is not None:
            rows = db.query(UserOrganizationLink.organization_id).filter(UserOrganizationLink.user_id == int(user_id)).all()
            allowed_org_ids.update(int(r.organization_id) for r in rows if r.organization_id is not None)
        
        fallback = auth_user.get("organization_id")
        if fallback is not None:
            allowed_org_ids.add(int(fallback))
            
        if not allowed_org_ids:
            return []
            
        feedbacks_query = feedbacks_query.join(Employee, Feedback.employee_id == Employee.id).filter(Employee.organization_id.in_(list(allowed_org_ids)))
        
    feedbacks = feedbacks_query.order_by(Feedback.created_at.desc()).all()
    
    result = []
    for fb in feedbacks:
        emp_name = None
        personal_id = None
        org_name = None
        if fb.employee:
            emp_name = f"{fb.employee.first_name} {fb.employee.last_name}"
            personal_id = fb.employee.personal_id
            if fb.employee.organization:
                org_name = fb.employee.organization.name
        
        result.append({
            "id": fb.id,
            "uuid": fb.uuid,
            "employee_id": fb.employee_id,
            "employee_name": emp_name,
            "employee_personal_id": personal_id,
            "organization_name": org_name,
            "title": fb.title,
            "message": fb.message,
            "is_read": fb.is_read,
            "created_at": fb.created_at
        })
        
    return result

@router.put("/{uuid}/read")
def mark_as_read(uuid: str, request: Request, db: Session = Depends(get_db)):
    auth_user = request.session.get("auth_user") or {}
    if not auth_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    fb = db.query(Feedback).filter(Feedback.uuid == uuid).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    fb.is_read = True
    db.commit()
    return {"ok": True, "message": "Marked as read"}
