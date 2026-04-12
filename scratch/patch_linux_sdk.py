import re

hikvision_sdk_path = "/Users/macbookpro/Documents/GitHub/BioFace/hikvision_sdk.py"
isup_sdk_server_path = "/Users/macbookpro/Documents/GitHub/BioFace/isup_sdk_server.py"

with open(hikvision_sdk_path, "r") as f:
    hik_content = f.read()

# Make REQUIRED_SDK_DLLS dynamic in hikvision_sdk.py
hik_content = hik_content.replace(
"""# Real Hikvision ISUP runtime DLL set used by the local SDK bridge.
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
)""",
"""import sys

IS_WIN = sys.platform == "win32"

if IS_WIN:
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
else:
    REQUIRED_SDK_DLLS = (
        "libHCISUPCMS.so",
        "libHCISUPAlarm.so",
        "libHCISUPSS.so",
        "libHCISUPStream.so",
        "libHCNetUtils.so",
        "libhpr.so",
        "libcrypto.so",
        "libssl.so",
    )
    OPTIONAL_SDK_DLLS = (
        "libPlayCtrl.so",
        "libsqlite3.so",
        "libz.so",
    )"""
)

with open(hikvision_sdk_path, "w") as f:
    f.write(hik_content)


with open(isup_sdk_server_path, "r") as f:
    isup_content = f.read()

isup_content = isup_content.replace(
"""        self._cms = ctypes.WinDLL(str(self.sdk_dir / "HCISUPCMS.dll"))
        self._alarm = ctypes.WinDLL(str(self.sdk_dir / "HCISUPAlarm.dll"))
        self._ss = ctypes.WinDLL(str(self.sdk_dir / "HCISUPSS.dll"))""",
"""        if sys.platform == "win32":
            self._cms = ctypes.WinDLL(str(self.sdk_dir / "HCISUPCMS.dll"))
            self._alarm = ctypes.WinDLL(str(self.sdk_dir / "HCISUPAlarm.dll"))
            self._ss = ctypes.WinDLL(str(self.sdk_dir / "HCISUPSS.dll"))
        else:
            self._cms = ctypes.CDLL(str(self.sdk_dir / "libHCISUPCMS.so"))
            self._alarm = ctypes.CDLL(str(self.sdk_dir / "libHCISUPAlarm.so"))
            self._ss = ctypes.CDLL(str(self.sdk_dir / "libHCISUPSS.so"))"""
)

isup_content = isup_content.replace(
"""        libeay_path = str((self.sdk_dir / "libeay32.dll").resolve())
        ssleay_path = str((self.sdk_dir / "ssleay32.dll").resolve())""",
"""        if sys.platform == "win32":
            libeay_path = str((self.sdk_dir / "libeay32.dll").resolve())
            ssleay_path = str((self.sdk_dir / "ssleay32.dll").resolve())
        else:
            libeay_path = str((self.sdk_dir / "libcrypto.so").resolve())
            ssleay_path = str((self.sdk_dir / "libssl.so").resolve())"""
)

with open(isup_sdk_server_path, "w") as f:
    f.write(isup_content)

print("Patch applied to both files.")
