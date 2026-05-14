from typing import Optional

ORGANIZATION_TYPE_DEFAULT = "boshqa"

ORGANIZATION_TYPE_CHOICES = [
    {"value": "mahalla", "label_uz": "Mahalla", "label_ru": "Mahalla"},
    {"value": "maktab", "label_uz": "Maktab", "label_ru": "Shkola"},
    {"value": "universitet", "label_uz": "Universitet", "label_ru": "Universitet"},
    {"value": "kollej", "label_uz": "Kollej", "label_ru": "Kolledzh"},
    {"value": "litsey", "label_uz": "Litsey", "label_ru": "Litsey"},
    {"value": "bogcha", "label_uz": "Bogcha", "label_ru": "Detskiy sad"},
    {"value": "korxona", "label_uz": "Korxona", "label_ru": "Predpriyatie"},
    {"value": "xususiy_tashkilot", "label_uz": "Xususiy tashkilot", "label_ru": "Chastnaya organizatsiya"},
    {"value": "davlat_tashkiloti", "label_uz": "Davlat tashkiloti", "label_ru": "Gos organizatsiya"},
    {"value": "boshqa", "label_uz": "Boshqa", "label_ru": "Drugoe"},
]

ORGANIZATION_TYPE_VALUES = {item["value"] for item in ORGANIZATION_TYPE_CHOICES}
ORGANIZATION_TYPE_LABELS_UZ = {item["value"]: item["label_uz"] for item in ORGANIZATION_TYPE_CHOICES}
ORGANIZATION_TYPE_LABELS_RU = {item["value"]: item["label_ru"] for item in ORGANIZATION_TYPE_CHOICES}


def normalize_organization_type(value: Optional[str]) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return ORGANIZATION_TYPE_DEFAULT
    return normalized if normalized in ORGANIZATION_TYPE_VALUES else ORGANIZATION_TYPE_DEFAULT


def get_organization_type_label(value: Optional[str], lang: str = "uz") -> str:
    normalized = normalize_organization_type(value)
    if lang == "ru":
        return ORGANIZATION_TYPE_LABELS_RU.get(normalized, ORGANIZATION_TYPE_LABELS_RU[ORGANIZATION_TYPE_DEFAULT])
    return ORGANIZATION_TYPE_LABELS_UZ.get(normalized, ORGANIZATION_TYPE_LABELS_UZ[ORGANIZATION_TYPE_DEFAULT])


def get_organization_type_choices(lang: str = "uz") -> list[dict]:
    label_key = "label_ru" if lang == "ru" else "label_uz"
    return [{"value": item["value"], "label": item[label_key]} for item in ORGANIZATION_TYPE_CHOICES]
