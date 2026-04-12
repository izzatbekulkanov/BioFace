from typing import Optional

from pydantic import BaseModel

from system_config import ISUP_KEY


class CameraCreate(BaseModel):
    name: str
    mac_address: Optional[str] = ""
    serial_number: Optional[str] = None
    isup_device_id: Optional[str] = None
    location: Optional[str] = ""
    model: Optional[str] = ""
    firmware_version: Optional[str] = None
    external_ip: Optional[str] = None
    protocol_version: Optional[str] = None
    webhook_enabled: Optional[bool] = None
    webhook_target_url: Optional[str] = None
    webhook_picture_sending: Optional[bool] = None
    max_memory: Optional[int] = 1500
    organization_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    isup_password: Optional[str] = ISUP_KEY


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    mac_address: Optional[str] = None
    serial_number: Optional[str] = None
    isup_device_id: Optional[str] = None
    location: Optional[str] = None
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    external_ip: Optional[str] = None
    protocol_version: Optional[str] = None
    webhook_enabled: Optional[bool] = None
    webhook_target_url: Optional[str] = None
    webhook_picture_sending: Optional[bool] = None
    max_memory: Optional[int] = None
    organization_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    isup_password: Optional[str] = None


class WebhookPayload(BaseModel):
    camera_mac: str
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    snapshot_url: Optional[str] = None
    timestamp: Optional[str] = None
    wellbeing_note_uz: Optional[str] = None
    wellbeing_note_ru: Optional[str] = None
    wellbeing_note_source: Optional[str] = None


class CommandPayload(BaseModel):
    command: str
    params: Optional[dict] = {}

