import shutil
from pathlib import Path

from system_config import BASE_DIR, HIKVISION_SDK_DIR, ISUP_IMPLEMENTATION_MODE


# Real Hikvision ISUP runtime DLL set used by the local SDK bridge.
REQUIRED_SDK_DLLS = (
    "HCISUPCMS.dll",
    "HCISUPAlarm.dll",
    "HCISUPSS.dll",
    "HCISUPStream.dll",
    "HCNetUtils.dll",
    "hpr.dll",
    "libeay32.dll",
    "ssleay32.dll",
)

OPTIONAL_SDK_DLLS = (
    "PlayCtrl.dll",
    "sqlite3.dll",
    "zlib1.dll",
    "OpenAL32.dll",
)

BUNDLED_RUNTIME_DIR = (
    BASE_DIR
    / "external"
    / "QuickNV.HikvisionISUPSDK"
    / "src"
    / "QuickNV.HikvisionISUPSDK.Native"
    / "runtimes"
    / "win7-x64"
    / "native"
)

_AUTO_STAGE_ATTEMPTED = False
_AUTO_STAGE_RESULT: dict | None = None


def _scan_sdk_dir(sdk_dir: Path) -> tuple[list[str], list[str], list[str]]:
    found: list[str] = []
    missing: list[str] = []
    optional_found: list[str] = []

    for dll in REQUIRED_SDK_DLLS:
        if (sdk_dir / dll).exists():
            found.append(dll)
        else:
            missing.append(dll)

    for dll in OPTIONAL_SDK_DLLS:
        if (sdk_dir / dll).exists():
            optional_found.append(dll)

    return found, missing, optional_found


def stage_sdk_runtime(
    target_dir: Path = HIKVISION_SDK_DIR,
    source_dir: Path = BUNDLED_RUNTIME_DIR,
) -> dict:
    if not source_dir.exists():
        return {
            "ok": False,
            "source_dir": str(source_dir),
            "target_dir": str(target_dir),
            "copied_files": [],
            "message": "Bundled SDK source topilmadi.",
        }

    copied_files: list[str] = []
    target_dir.mkdir(parents=True, exist_ok=True)

    for file_path in source_dir.glob("*"):
        if file_path.is_file() and file_path.suffix.lower() == ".dll":
            dst = target_dir / file_path.name
            if not dst.exists():
                shutil.copy2(file_path, dst)
                copied_files.append(file_path.name)

    hcaap_src = source_dir / "HCAapSDKCom"
    if hcaap_src.exists() and hcaap_src.is_dir():
        hcaap_dst = target_dir / "HCAapSDKCom"
        hcaap_dst.mkdir(parents=True, exist_ok=True)
        for file_path in hcaap_src.glob("*"):
            if file_path.is_file():
                dst = hcaap_dst / file_path.name
                if not dst.exists():
                    shutil.copy2(file_path, dst)
                    copied_files.append(f"HCAapSDKCom/{file_path.name}")

    return {
        "ok": True,
        "source_dir": str(source_dir),
        "target_dir": str(target_dir),
        "copied_files": copied_files,
        "message": "SDK runtime tayyorlandi.",
    }


def _maybe_auto_stage() -> dict | None:
    global _AUTO_STAGE_ATTEMPTED, _AUTO_STAGE_RESULT
    if _AUTO_STAGE_ATTEMPTED:
        return _AUTO_STAGE_RESULT

    _AUTO_STAGE_ATTEMPTED = True
    _AUTO_STAGE_RESULT = stage_sdk_runtime()
    return _AUTO_STAGE_RESULT


def get_sdk_status() -> dict:
    sdk_dir = HIKVISION_SDK_DIR
    auto_stage = None

    if ISUP_IMPLEMENTATION_MODE == "hikvision_sdk":
        exists = sdk_dir.exists() and sdk_dir.is_dir()
        if not exists:
            auto_stage = _maybe_auto_stage()
        else:
            _, missing_before, _ = _scan_sdk_dir(sdk_dir)
            if missing_before:
                auto_stage = _maybe_auto_stage()

    exists = sdk_dir.exists() and sdk_dir.is_dir()
    found, missing, optional_found = _scan_sdk_dir(sdk_dir) if exists else ([], list(REQUIRED_SDK_DLLS), [])

    ready = ISUP_IMPLEMENTATION_MODE == "hikvision_sdk" and exists and not missing
    if ISUP_IMPLEMENTATION_MODE != "hikvision_sdk":
        note = "ISUP emulated mode faol; rasmiy Hikvision SDK mode yoqilmagan."
    elif not exists:
        note = "Hikvision SDK papkasi topilmadi."
    elif missing:
        note = "Hikvision SDK papkasida majburiy DLL lar to'liq emas."
    else:
        note = "Hikvision SDK mode uchun zarur runtime fayllar topildi."

    return {
        "mode": ISUP_IMPLEMENTATION_MODE,
        "sdk_dir": str(sdk_dir),
        "sdk_dir_exists": exists,
        "bundled_runtime_dir": str(BUNDLED_RUNTIME_DIR),
        "required_dlls": list(REQUIRED_SDK_DLLS),
        "optional_dlls": list(OPTIONAL_SDK_DLLS),
        "found_dlls": found,
        "missing_dlls": missing,
        "optional_found_dlls": optional_found,
        "auto_stage": auto_stage,
        "ready": ready,
        "note": note,
    }
