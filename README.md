# BioFace

BioFace is a FastAPI-based attendance and camera management system with Hikvision iSUP integration.

## Stack

- FastAPI + Jinja2
- SQLite via SQLAlchemy
- Redis for iSUP command/response transport
- Hikvision SDK bridge (`isup_sdk_server.py`)
- Optional C++ iSUP server prototype in `isup_server/`

## What Is Intentionally Excluded

This repository is prepared for GitHub push and does not include local runtime data:

- `bioface.db`
- `menu.json`
- `static/uploads/`
- `.runtime/`
- `isup_server/build/`
- local IDE state and virtual environments

Use `.env.example` and `menu.example.json` as templates for local setup.

## Local Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Copy environment values if needed:

```powershell
Copy-Item .env.example .env
Copy-Item menu.example.json menu.json
```

4. Review and change sensitive defaults before production:

- `SESSION_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
- `ISUP_KEY`
- `ISUP_PUBLIC_HOST`
- `PUBLIC_WEB_BASE_URL`

5. Start Redis, iSUP, and the web app:

```powershell
.\start.ps1
```

For local development with Tailwind watcher:

```powershell
.\dev.ps1
```

## Deploy Helper

`deploy.ps1` was sanitized for public use. Pass target values explicitly:

```powershell
.\deploy.ps1 -Server user@example-host -Dest ~/BioFace
```

## Hikvision SDK Note

The project currently depends on Hikvision runtime files inside `hikvision_sdk/`. If you publish this repository publicly, verify that distributing those binaries is allowed by their license.
