from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import os
import time
from PIL import Image
import io
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List, Union

from database import get_db
from bot_process_manager import (
    get_bot_process_status,
    restart_bot_process,
    start_bot_process,
    stop_bot_process,
)
from isup_manager import restart_isup_server
from models import Organization, TelegramUserBinding
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
    telegram_enabled: Optional[bool] = None
    telegram_admin_chat_id: Optional[str] = None
    telegram_bot_token: Optional[str] = None


def _mask_secret(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) <= 8:
        return "*" * len(text)
    return f"{text[:4]}{'*' * (len(text) - 8)}{text[-4:]}"


def _get_primary_org(db: Session) -> Organization:
    org = db.query(Organization).order_by(Organization.id.asc()).first()
    if not org:
        org = Organization(name="Asosiy Tashkilot")
        db.add(org)
        db.commit()
        db.refresh(org)
    return org

@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    org = _get_primary_org(db)
    saved_data = get_menu_data()
    saved_isup_host = normalize_isup_public_host(saved_data.get("isup_public_host"))
    saved_public_web_base_url = normalize_public_web_base_url(saved_data.get("public_web_base_url"))
    telegram_user_count = db.query(TelegramUserBinding).count() or 0
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
        "telegram_enabled": bool(org.telegram_enabled),
        "telegram_admin_chat_id": str(org.telegram_admin_chat_id or ""),
        "telegram_token_configured": bool(str(org.telegram_bot_token or "").strip()),
        "telegram_bot_token_masked": _mask_secret(org.telegram_bot_token),
        "telegram_users_count": telegram_user_count,
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

    org = _get_primary_org(db)
    previous_telegram_enabled = bool(org.telegram_enabled)
    previous_token = str(org.telegram_bot_token or "").strip()

    if data.default_start_time is not None:
        org.default_start_time = data.default_start_time
    if data.default_end_time is not None:
        org.default_end_time = data.default_end_time
        
    db.commit()
    
    if data.app_name is not None or data.logo_url is not None or data.favicon_url is not None or data.isup_public_host is not None or data.public_web_base_url is not None:
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

    if data.telegram_enabled is not None:
        org.telegram_enabled = bool(data.telegram_enabled)
    if data.telegram_admin_chat_id is not None:
        org.telegram_admin_chat_id = data.telegram_admin_chat_id.strip() or None
    if data.telegram_bot_token is not None:
        incoming_token = data.telegram_bot_token.strip()
        if incoming_token:
            org.telegram_bot_token = incoming_token
    db.commit()

    bot_runtime = None
    current_token = str(org.telegram_bot_token or "").strip()
    token_changed = bool(current_token) and current_token != previous_token
    telegram_enabled_now = bool(org.telegram_enabled)
    enabled_changed = telegram_enabled_now != previous_telegram_enabled

    try:
        if telegram_enabled_now and current_token and (token_changed or enabled_changed):
            bot_running = bool(get_bot_process_status().get("running"))
            bot_runtime = {
                "ok": True,
                "action": "restart" if bot_running else "start",
                "status": restart_bot_process() if bot_running else start_bot_process(),
            }
        elif not telegram_enabled_now and enabled_changed:
            bot_runtime = {
                "ok": True,
                "action": "stop",
                "status": stop_bot_process(),
            }
    except Exception as exc:
        bot_runtime = {
            "ok": False,
            "error": str(exc),
        }

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
        "bot_runtime": bot_runtime,
        "public_web_base_url": normalized_public_web_base_url,
    }


@router.get("/api/telegram/process")
def telegram_process_status():
    return {"ok": True, "status": get_bot_process_status()}


@router.post("/api/telegram/process/start")
def telegram_process_start():
    try:
        status = start_bot_process()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "Telegram bot ishga tushirildi", "status": status}


@router.post("/api/telegram/process/stop")
def telegram_process_stop():
    try:
        status = stop_bot_process()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "Telegram bot to'xtatildi", "status": status}


@router.post("/api/telegram/process/restart")
def telegram_process_restart():
    try:
        status = restart_bot_process()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "Telegram bot qayta ishga tushirildi", "status": status}

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
