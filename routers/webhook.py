import json
from datetime import datetime
from fastapi import APIRouter, File, Form, UploadFile, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()

@router.post("/events")
async def camera_webhook(
    event_info: str = Form(...),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    Hikvision kamerasidan Http Listening (Event) qabul qiluvchi API.
    Aksariyat variantlarda Hikvision metadata va faylni multipart tarzda yuboradi.
    """
    try:
        data = json.loads(event_info)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Noto'g'ri JSON formati keldi")
    
    employee_id = data.get("employee_id")
    serial_no = data.get("device_serial")
    
    # Bazadan qurilmani izlab topish
    device = db.query(models.Device).filter(models.Device.ip_or_serial == serial_no).first()
    if not device:
        raise HTTPException(status_code=404, detail="Bunday seriayli kamera bazada topilmadi.")

    # Rasmni saqlash
    snapshot_url = None
    if picture:
        file_path = f"static/uploads/{picture.filename}"
        with open(file_path, "wb+") as file_object:
            file_object.write(await picture.read())
        snapshot_url = f"/static/uploads/{picture.filename}"

    # Bazaga Log yaratish
    new_log = models.AttendanceLog(
        employee_id=employee_id, 
        device_id=device.id,
        timestamp=datetime.utcnow(),
        snapshot_url=snapshot_url,
        status="ruxsat berilgan"
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    return {"status": "success", "message": "Voqea muvaffaqiyatli saqlandi", "log_id": new_log.id}
