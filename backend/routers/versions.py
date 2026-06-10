"""
Versiya nazorati — System Version Management router.
Endpoints:
  GET    /api/versions         -> list all versions
  POST   /api/versions         -> create a new version record
  PUT    /api/versions/{id}    -> update a version record
  DELETE /api/versions/{id}    -> delete a version record
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import SystemVersion

router = APIRouter(prefix="/api/versions", tags=["Versions API"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class VersionIn(BaseModel):
    version: str
    module: Optional[str] = "core"
    title: Optional[str] = None
    release_notes: Optional[str] = None
    author: Optional[str] = None
    status: Optional[str] = "released"
    released_at: Optional[datetime] = None


class VersionOut(BaseModel):
    id: int
    version: str
    module: Optional[str]
    title: Optional[str]
    release_notes: Optional[str]
    author: Optional[str]
    status: Optional[str]
    released_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[VersionOut])
def list_versions(db: Session = Depends(get_db)):
    return db.query(SystemVersion).order_by(SystemVersion.id.desc()).all()


@router.post("", response_model=VersionOut, status_code=201)
def create_version(data: VersionIn, db: Session = Depends(get_db)):
    v = SystemVersion(**data.dict())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/{version_id}", response_model=VersionOut)
def update_version(version_id: int, data: VersionIn, db: Session = Depends(get_db)):
    v = db.query(SystemVersion).filter(SystemVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    for k, val in data.dict(exclude_unset=True).items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{version_id}", status_code=204)
def delete_version(version_id: int, db: Session = Depends(get_db)):
    v = db.query(SystemVersion).filter(SystemVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    db.delete(v)
    db.commit()
