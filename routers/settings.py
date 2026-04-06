from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import os
import shutil
import time
from PIL import Image
import io
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List, Union

from database import get_db
from isup_manager import restart_isup_server
from models import Organization
from menu_utils import get_menu_data, save_menu_data
from system_config import (
    get_detected_lan_ipv4,
    get_public_web_base_url,
    get_isup_public_host,
    normalize_public_web_base_url,
    normalize_isup_public_host,
)


router = APIRouter()

class SettingsUpdate(BaseModel):
    app_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    default_start_time: Optional[str] = None
    default_end_time: Optional[str] = None
    isup_public_host: Optional[str] = None
    public_web_base_url: Optional[str] = None

@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Asosiy Tashkilot")
        db.add(org)
        db.commit()
        db.refresh(org)
    
    saved_data = get_menu_data()
    saved_isup_host = normalize_isup_public_host(saved_data.get("isup_public_host"))
    saved_public_web_base_url = normalize_public_web_base_url(saved_data.get("public_web_base_url"))
    return {
        "ok": True,
        "app_name": saved_data.get("app_name", "BioFace"),
        "logo_url": saved_data.get("logo_url", ""),
        "favicon_url": saved_data.get("favicon_url", ""),
        "default_start_time": org.default_start_time,
        "default_end_time": org.default_end_time,
        "isup_public_host": saved_isup_host or get_isup_public_host(),
        "public_web_base_url": saved_public_web_base_url or get_public_web_base_url(),
        "detected_lan_ip": get_detected_lan_ipv4(),
    }

@router.put("/api/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    previous_isup_host = normalize_isup_public_host(get_menu_data().get("isup_public_host"))
    if previous_isup_host == "":
        previous_isup_host = get_isup_public_host()

    normalized_host: Optional[str] = None
    if data.isup_public_host is not None:
        raw_host = data.isup_public_host.strip()
        normalized_host = normalize_isup_public_host(raw_host)
        if raw_host and not normalized_host:
            raise HTTPException(
                status_code=422,
                detail="ISUP host noto'g'ri. Faqat IP yoki domain kiriting (masalan: 10.10.1.10 yoki 203.0.113.10).",
            )

    normalized_public_web_base_url: Optional[str] = None
    if data.public_web_base_url is not None:
        raw_public_web_base_url = data.public_web_base_url.strip()
        normalized_public_web_base_url = normalize_public_web_base_url(raw_public_web_base_url)
        if raw_public_web_base_url and not normalized_public_web_base_url:
            raise HTTPException(
                status_code=422,
                detail="Public web URL noto'g'ri. Faqat http/https URL kiriting (masalan: https://example.com).",
            )

    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Asosiy Tashkilot")
        db.add(org)

    if data.default_start_time is not None:
        org.default_start_time = data.default_start_time
    if data.default_end_time is not None:
        org.default_end_time = data.default_end_time
        
    db.commit()
    
    if (
        data.app_name is not None
        or data.logo_url is not None
        or data.favicon_url is not None
        or data.isup_public_host is not None
        or data.public_web_base_url is not None
    ):
        import json
        from menu_utils import MENU_FILE
        menu_data = get_menu_data()
        
        if data.app_name is not None:
            menu_data["app_name"] = data.app_name.strip() or "BioFace"
        if data.logo_url is not None:
            menu_data["logo_url"] = data.logo_url.strip()
        if data.favicon_url is not None:
            menu_data["favicon_url"] = data.favicon_url.strip()
        if data.isup_public_host is not None and normalized_host is not None:
            menu_data["isup_public_host"] = normalized_host
        if data.public_web_base_url is not None and normalized_public_web_base_url is not None:
            menu_data["public_web_base_url"] = normalized_public_web_base_url
            
        try:
            with open(MENU_FILE, "w", encoding="utf-8") as f:
                json.dump(menu_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving settings to {MENU_FILE}:", e)

    isup_restart = None
    if data.isup_public_host is not None and normalized_host is not None:
        if normalized_host != (previous_isup_host or ""):
            try:
                status = restart_isup_server()
                isup_restart = {
                    "ok": True,
                    "running": bool(status.get("running")),
                    "pid": status.get("pid"),
                    "public_host": normalized_host,
                }
            except Exception as exc:
                isup_restart = {
                    "ok": False,
                    "public_host": normalized_host,
                    "error": str(exc),
                }

    return {
        "ok": True,
        "message": "Sozlamalar saqlandi.",
        "isup_restart": isup_restart,
        "public_web_base_url": normalized_public_web_base_url,
    }

class MenuUpdates(BaseModel):
    menus: Dict[str, Union[str, Dict[str, str]]]
    order: Optional[List[str]] = None

@router.get("/api/menu_settings")
def get_menu_settings():
    saved_data = get_menu_data()
    return {"ok": True, "menus": saved_data.get("menus", {})}

@router.put("/api/menu_settings")
def update_menu_settings(data: MenuUpdates):
    success = save_menu_data(data.menus, data.order)
    if success:
        return {"ok": True, "message": "Menyu nomlari saqlandi."}
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Menyu saqlashda xatolik yuz berdi")

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/api/settings/upload_logo")
async def upload_logo(file: UploadFile = File(...)):
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        
        # Logolar o'z holatcha yoki PNG shaklida shaffof bo'lib saqlanishi kerak
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        filename = f"logo_{int(time.time())}.png"
        filepath = os.path.join(UPLOAD_DIR, filename)
        img.save(filepath, format="PNG")
        
        return {"ok": True, "url": f"/static/uploads/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/settings/upload_favicon")
async def upload_favicon(file: UploadFile = File(...)):
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
            
        # Get the bounding box of the non-zero regions in the image
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        width, height = img.size
        if width != height:
            size = max(width, height)
            new_img = Image.new('RGBA', (size, size), (255, 255, 255, 0)) # Kvadrat, transparent fon
            x = (size - width) // 2
            y = (size - height) // 2
            new_img.paste(img, (x, y))
            img = new_img
        
        filename = f"favicon_{int(time.time())}.png"
        filepath = os.path.join(UPLOAD_DIR, filename)
        # .ico yoki .png sifatida saqlash mumkin. Hozirgi kunda .png ni hamma browser qo'llab quvvatlaydi.
        img.save(filepath, format="PNG")
        
        return {"ok": True, "url": f"/static/uploads/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
