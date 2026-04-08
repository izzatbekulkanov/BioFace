import re
from typing import Any, Optional


GENERIC_CAMERA_MODELS = {
    "hikvision isup",
    "hikvision_isup",
    "hikvision-isup",
    "isup",
}


def _pick_first_nonempty(device: dict, keys: tuple[str, ...]) -> Optional[str]:
    for key in keys:
        value = device.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text and text != "-":
            return text
    return None


def _normalize_model_key(value: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[\s_-]+", " ", text)


def _is_generic_camera_model(value: Optional[str]) -> bool:
    return _normalize_model_key(value) in GENERIC_CAMERA_MODELS


def _prefer_persistent_model(current_model: Optional[str], live_model: Optional[str]) -> Optional[str]:
    current = str(current_model or "").strip()
    live = str(live_model or "").strip()

    if not live:
        return current or None
    if current and not _is_generic_camera_model(current):
        return current
    if _is_generic_camera_model(live) and current:
        return current
    return live


def _extract_command_camera_info(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    camera_info = payload.get("camera_info")
    if isinstance(camera_info, dict):
        return camera_info
    nested = payload.get("response")
    if isinstance(nested, dict):
        nested_info = nested.get("camera_info")
        if isinstance(nested_info, dict):
            return nested_info
    return {}


def _normalize_mac_address(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().upper()
    if not raw:
        return None
    if re.fullmatch(r"[0-9A-F]{12}", raw):
        return ":".join(raw[i:i + 2] for i in range(0, 12, 2))
    if re.fullmatch(r"[0-9A-F]{2}([-:][0-9A-F]{2}){5}", raw):
        return raw.replace("-", ":")
    return raw


def _strip_or_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None

