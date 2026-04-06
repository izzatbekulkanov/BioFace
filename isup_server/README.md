# BioFace ISUP Server

Hikvision kameralarni **boshqa tarmoqdan** BioFace tizimiga ulash uchun ISUP protokol serveri.

## Qanday ishlaydi?

```
[Kamera - Tarmoq A]  ──TCP 7660──▶  [ISUP C++ Server]  ──HTTP 7670──▶  [BioFace Python]
[Kamera - Tarmoq B]  ──TCP 7660──▶       │
                                          ▼
                                   [DeviceRegistry]
```

Kamera o'zi serverga ulanadi (NAT orqali ham ishlaydi). Server kamerani ro'yxatga oladi va BioFace backend REST API orqali ma'lumot oladi.

## Build (Windows — MinGW)

```bash
cd isup_server
mkdir build && cd build
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
mingw32-make
```

## Build (Windows — Visual Studio)

```bash
cd isup_server
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022"
cmake --build . --config Release
```

## Build (Linux)

```bash
cd isup_server && mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j4
```

## Ishga tushirish

```bash
# Default (port 7660, API 7670, key: bioface2024)
./isup_server

# Custom
./isup_server  <isup_key>  <isup_port>  <api_port>
./isup_server  mySecretKey  7660  7670
```

## Kamerani sozlash (Hikvision)

Kamera veb-interfeysi yoki Hik-Connect ilovasiga kiring:

```
Configuration → Network → Advanced → Platform Access
  ├── Enable:         ✅ (yoqish)
  ├── Protocol:       ISUP
  ├── Server Address: <BioFace serveringiz IP manzili>
  ├── Port:           7660
  ├── Device ID:      <ixtiyoriy nom, masalan: cam-001>
  └── ISUP Key:       bioface2024   (main.cpp dagi kalit bilan bir xil bo'lishi kerak)
```

## REST API (port 7670)

| Endpoint | Metod | Tavsif |
|---|---|---|
| `/health` | GET | Server holati (`{"status":"ok","devices":2}`) |
| `/devices` | GET | Barcha ulangan kameralar (JSON) |
| `/devices/{id}` | GET | Bitta kamera ma'lumotlari |
| `/devices/{id}` | DELETE | Kamerani uzish |

### Misol javob (`GET /devices`)
```json
[
  {
    "device_id": "cam-001",
    "ip": "192.168.50.12",
    "port": 54321,
    "model": "DS-2CD2143G2-I",
    "firmware": "V5.7.5",
    "isup_version": "5.0",
    "online": true,
    "registered_at": "2024-03-12T09:00:00Z",
    "last_seen": "2024-03-12T09:05:10Z",
    "rtsp_url": "rtsp://192.168.50.12:554/Streaming/Channels/101"
  }
]
```

## BioFace integratsiya

BioFace Python backend `GET /api/isup-devices` endpointi orqali ISUP serverdan kameralar ro'yxatini oladi:

```
http://localhost:8000/api/isup-devices
```

## Portlar

| Port | Maqsad |
|------|--------|
| 7660 TCP | Kameralardan ISUP ro'yxatdan o'tish |
| 7670 HTTP | BioFace → ISUP REST API |
| 8000 HTTP | BioFace asosiy server |
