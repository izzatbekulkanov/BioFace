#!/usr/bin/env python3
"""
BioFace WebApp — Full PRO Redesign Script
Injects a comprehensive override CSS + replaces profile/home tab HTML
"""

import re

FILE = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'

# ============================================================
# 1. PRO Override CSS (replaces the existing appended CSS)
# ============================================================
PRO_CSS = """
    /* =====================================================================
       BIOFACE PRO DESIGN SYSTEM — Complete Override
       Inspired by: bioface.uz main site (Tailwind dark + slate palette)
       ===================================================================== */

    :root {
      /* BioFace brand: slate-based dark with sky-blue accent */
      --bf-bg:        #020617;
      --bf-card:      #0f172a;
      --bf-card2:     #1e293b;
      --bf-border:    rgba(255,255,255,0.07);
      --bf-accent:    #38bdf8;
      --bf-accent2:   #0ea5e9;
      --bf-success:   #10b981;
      --bf-error:     #ef4444;
      --bf-warning:   #f59e0b;
      --bf-violet:    #a855f7;
      --bf-pink:      #ec4899;
      --bf-text:      #f1f5f9;
      --bf-muted:     #64748b;
      --bf-subtle:    #334155;
    }

    /* --- Base resets --- */
    body {
      background: var(--bf-bg) !important;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif !important;
      color: var(--bf-text) !important;
    }

    /* --- Glass cards --- */
    .glass-card {
      background: rgba(15, 23, 42, 0.75) !important;
      border: 1px solid var(--bf-border) !important;
      border-radius: 20px !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    /* --- Portal Header --- */
    .portal-header {
      background: rgba(2, 6, 23, 0.95) !important;
      border-bottom: 1px solid var(--bf-border) !important;
      padding: 14px 20px !important;
    }

    /* --- Bottom Navigation --- */
    .nav-bar {
      background: rgba(9, 14, 28, 0.98) !important;
      border: 1px solid rgba(255,255,255,0.06) !important;
      border-radius: 28px !important;
      height: 70px !important;
      width: 92% !important;
      max-width: 360px !important;
      bottom: 16px !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
    }

    .nav-item {
      height: 52px !important;
      width: 80px !important;
      border-radius: 20px !important;
      gap: 3px !important;
    }

    .nav-item.active {
      color: var(--bf-accent) !important;
      transform: none !important;
    }

    .nav-item svg {
      width: 22px !important;
      height: 22px !important;
    }

    .nav-item span {
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
    }

    .nav-indicator {
      background: rgba(56, 189, 248, 0.12) !important;
      border: 1px solid rgba(56, 189, 248, 0.2) !important;
      border-radius: 20px !important;
      box-shadow: none !important;
    }

    /* --- Action Buttons (Check In/Out) --- */
    .action-btn-large {
      border-radius: 24px !important;
      padding: 22px 12px !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .action-btn-large.in {
      background: linear-gradient(145deg, rgba(16,185,129,0.15), rgba(16,185,129,0.06)) !important;
      border: 1.5px solid rgba(16,185,129,0.25) !important;
    }

    .action-btn-large:not(.in) {
      background: linear-gradient(145deg, rgba(56,189,248,0.15), rgba(56,189,248,0.06)) !important;
      border: 1.5px solid rgba(56,189,248,0.25) !important;
    }

    .action-btn-title {
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
    }

    .action-btn-sub {
      font-size: 10px !important;
      opacity: 0.6 !important;
    }

    /* --- Clock Cards --- */
    .clock-card {
      border-radius: 20px !important;
    }

    .clock-card::before {
      height: 2px !important;
    }

    .clock-time {
      font-size: 28px !important;
      font-weight: 800 !important;
      letter-spacing: -1px !important;
    }

    .clock-label {
      font-size: 10px !important;
      letter-spacing: 1px !important;
    }

    /* --- Stat Cards --- */
    .stats-grid {
      gap: 12px !important;
      margin-bottom: 20px !important;
    }

    .stat-card {
      border-radius: 18px !important;
      padding: 14px !important;
      background: rgba(30, 41, 59, 0.6) !important;
      border: 1px solid rgba(255,255,255,0.05) !important;
    }

    .stat-value {
      font-size: 15px !important;
      font-weight: 800 !important;
      background: linear-gradient(135deg, #fff 0%, #94a3b8 100%) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }

    .stat-icon {
      width: 38px !important;
      height: 38px !important;
      border-radius: 12px !important;
      background: rgba(255,255,255,0.05) !important;
    }

    /* --- History Items --- */
    .history-item {
      border-radius: 18px !important;
      padding: 14px 16px !important;
      background: rgba(15,23,42,0.7) !important;
      border: 1px solid rgba(255,255,255,0.05) !important;
    }

    /* --- Login View --- */
    .login-header h1 {
      font-size: 30px !important;
      letter-spacing: 3px !important;
    }

    .logo-container {
      width: 110px !important;
      height: 110px !important;
      box-shadow: 0 0 40px rgba(56,189,248,0.2) !important;
      animation: none !important;
    }

    .input-field {
      background: rgba(15,23,42,0.8) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 16px !important;
      padding: 16px !important;
      font-size: 15px !important;
    }

    .input-field:focus {
      border-color: var(--bf-accent) !important;
      box-shadow: 0 0 0 3px rgba(56,189,248,0.12) !important;
    }

    /* --- Dropdown --- */
    .profile-dropdown {
      border-radius: 24px !important;
      background: rgba(9,14,28,0.98) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: 0 24px 60px rgba(0,0,0,0.7) !important;
    }

    /* --- Calendar cells --- */
    .calendar-day-cell {
      border-radius: 10px !important;
    }

    /* --- Toast --- */
    .toast-container {
      backdrop-filter: none !important;
      background: rgba(15,23,42,0.97) !important;
      border-radius: 16px !important;
      border-left: 3px solid var(--bf-accent) !important;
    }

    /* --- Geofence card --- */
    .geofence-card {
      border-radius: 20px !important;
      padding: 14px 16px !important;
      background: rgba(15,23,42,0.7) !important;
    }

    /* --- Profile Hero card --- */
    .profile-hero-card::after {
      animation: none !important;
      background: none !important;
    }

    /* --- Skeleton --- */
    .skeleton-text, .skeleton-block {
      animation: skeleton-shimmer 1.5s ease-in-out infinite !important;
    }

    /* --- Modal --- */
    .modal-overlay {
      backdrop-filter: blur(4px) !important;
    }

    /* --- Date panel --- */
    .date-panel h2 {
      font-size: 22px !important;
      font-weight: 800 !important;
      letter-spacing: -0.5px !important;
    }

    /* --- History header --- */
    .history-header h2 {
      font-size: 22px !important;
      font-weight: 800 !important;
    }

    /* --- Home tab padding fix --- */
    #tab-home {
      padding: 20px 16px !important;
      padding-bottom: 100px !important;
    }

    #tab-history {
      padding: 20px 16px !important;
      padding-bottom: 100px !important;
    }

    /* =====================================================================
       HOME PAGE QUICK STATS SECTION
       ===================================================================== */
    .stats-section-header h3 {
      font-size: 13px !important;
      font-weight: 700 !important;
      color: var(--bf-muted) !important;
      text-transform: uppercase !important;
      letter-spacing: 1px !important;
    }

    /* =====================================================================
       LIST-ITEM ACTION (used in settings rows in profile tab)
       ===================================================================== */
    .list-item-action:hover {
      background: rgba(255,255,255,0.03);
    }
    .list-item-action:active {
      background: rgba(255,255,255,0.06);
    }
"""

# ============================================================
# 2. Replace the Profile Tab HTML with a clean PRO layout
# ============================================================
NEW_PROFILE_TAB = '''<div id="tab-profile" class="tab-view" style="padding: 20px 16px; padding-bottom: 110px; overflow-y: auto; background: var(--bf-bg, #020617);">

        <!-- ── PROFILE HERO CARD ────────────────────────────── -->
        <div style="position:relative; background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%); border-radius: 28px; border: 1px solid rgba(255,255,255,0.07); overflow: hidden; padding: 28px 20px 24px; text-align: center; margin-bottom: 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.4);">

          <!-- subtle accent glow top-right -->
          <div style="position:absolute; top:-40px; right:-40px; width:130px; height:130px; background:#38bdf8; border-radius:50%; opacity:0.06; pointer-events:none;"></div>

          <!-- Avatar -->
          <div style="position:relative; width:96px; height:96px; margin:0 auto 18px;">
            <div style="width:100%; height:100%; border-radius:50%; padding:3px; background: linear-gradient(135deg,#38bdf8,#a855f7,#ec4899);">
              <div id="profile-avatar-container" style="width:100%; height:100%; border-radius:50%; overflow:hidden; background:#0f172a; position:relative;">
                <img id="profile-avatar" src="https://www.w3schools.com/howto/img_avatar.png" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">
              </div>
            </div>
            <!-- Camera badge -->
            <div id="profile-avatar-camera-badge" onclick="openAvatarEditor()" style="display:none; position:absolute; bottom:-2px; right:-2px; width:32px; height:32px; background:linear-gradient(135deg,#ec4899,#f43f5e); border-radius:50%; align-items:center; justify-content:center; border:3px solid #0f172a; cursor:pointer; box-shadow:0 4px 12px rgba(236,72,153,0.4);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          </div>

          <!-- Name + role -->
          <h2 id="profile-name" style="font-size:22px; font-weight:800; color:#f1f5f9; margin:0 0 6px; line-height:1.2;">—</h2>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); padding:5px 14px; border-radius:20px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span id="profile-role" style="font-size:12px; color:#38bdf8; font-weight:600;">—</span>
          </div>

          <!-- Update avatar button (only if no avatar set) -->
          <button id="btn-profile-change-avatar" onclick="openAvatarEditor()" style="display:none; margin-top:16px; width:100%; background:linear-gradient(135deg,#38bdf8,#0ea5e9); border:none; border-radius:16px; padding:12px; color:#fff; font-weight:700; font-size:14px; cursor:pointer;">Rasmni yangilash</button>
        </div>

        <!-- ── 2-COLUMN INFO GRID ─────────────────────────────── -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px;">

          <!-- Department -->
          <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.05); border-radius:22px; padding:16px;">
            <div style="width:38px; height:38px; border-radius:12px; background:rgba(56,189,248,0.12); display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;" id="lbl-prof-dept">Bo'lim</div>
            <div id="profile-dept-val" style="font-size:13px; color:#f1f5f9; font-weight:700; line-height:1.3; word-break:break-word;">—</div>
          </div>

          <!-- Position -->
          <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.05); border-radius:22px; padding:16px;">
            <div style="width:38px; height:38px; border-radius:12px; background:rgba(168,85,247,0.12); display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;" id="lbl-prof-pos">Lavozim</div>
            <div id="profile-pos-val" style="font-size:13px; color:#f1f5f9; font-weight:700; line-height:1.3; word-break:break-word;">—</div>
          </div>
        </div>

        <!-- ── DETAILS LIST ───────────────────────────────────── -->
        <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.8px; margin:0 2px 10px;">Ma'lumotlar</div>
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.05); border-radius:24px; overflow:hidden; margin-bottom:20px;">

          <!-- ID -->
          <div style="display:flex; align-items:center; padding:15px 18px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(251,146,60,0.12); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:11px; color:#64748b; font-weight:500; margin-bottom:2px;">Personal ID</div>
              <div id="profile-id-val" style="font-size:14px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>

          <!-- Phone -->
          <div style="display:flex; align-items:center; padding:15px 18px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(16,185,129,0.12); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:11px; color:#64748b; font-weight:500; margin-bottom:2px;">Telefon</div>
              <div id="profile-phone-val" style="font-size:14px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>

          <!-- Work hours -->
          <div style="display:flex; align-items:center; padding:15px 18px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(236,72,153,0.12); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:11px; color:#64748b; font-weight:500; margin-bottom:2px;">Ish vaqti</div>
              <div id="profile-time-val" style="font-size:14px; color:#f1f5f9; font-weight:700;">—</div>
            </div>
          </div>

          <!-- Branch -->
          <div style="display:flex; align-items:center; padding:15px 18px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(99,102,241,0.12); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:11px; color:#64748b; font-weight:500; margin-bottom:2px;">Filial</div>
              <div id="profile-branch-val" style="font-size:14px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>

          <!-- Salary (hidden by default) -->
          <div id="row-profile-salary" style="display:none; align-items:center; padding:15px 18px;">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(16,185,129,0.12); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:11px; color:#64748b; font-weight:500; margin-bottom:2px;">Oylik maosh</div>
              <div id="profile-salary-val" style="font-size:18px; color:#10b981; font-weight:800; letter-spacing:-.5px;">—</div>
            </div>
          </div>
        </div>

        <!-- ── SETTINGS LIST ──────────────────────────────────── -->
        <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.8px; margin:0 2px 10px;">Sozlamalar</div>
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.05); border-radius:24px; overflow:hidden; margin-bottom:20px;">

          <!-- Language switch -->
          <div class="list-item-action" onclick="switchLanguage(currentLang === 'UZ' ? 'RU' : 'UZ')" style="display:flex; align-items:center; padding:15px 18px; border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer; transition:background .2s;">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(148,163,184,0.1); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:14px; color:#f1f5f9; font-weight:600;">Tilni o'zgartirish</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span id="current-lang-indicator" style="font-size:13px; font-weight:800; color:#38bdf8;">UZ</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>

          <!-- Logout -->
          <div class="list-item-action" onclick="logout()" style="display:flex; align-items:center; padding:15px 18px; cursor:pointer; transition:background .2s;">
            <div style="width:34px; height:34px; border-radius:11px; background:rgba(239,68,68,0.1); display:flex; align-items:center; justify-content:center; margin-right:14px; flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:14px; color:#ef4444; font-weight:600;">Hisobdan chiqish</div>
            </div>
          </div>
        </div>

      </div>
'''


def apply_redesign():
    with open(FILE, 'r', encoding='utf-8') as f:
        html = f.read()

    # --- Step 1: Inject PRO CSS before </style> (last occurrence) ---
    last_style_close = html.rfind('</style>')
    if last_style_close == -1:
        print("ERROR: </style> not found")
        return

    html = html[:last_style_close] + PRO_CSS + '\n  </style>' + html[last_style_close + len('</style>'):]
    print("✅ PRO CSS injected")

    # --- Step 2: Replace profile tab HTML ---
    # Find the opening of tab-profile div
    start_marker = '<div id="tab-profile"'
    start_idx = html.find(start_marker)
    if start_idx == -1:
        print("ERROR: profile tab not found")
        return

    # Walk to find the matching closing div
    depth = 0
    i = start_idx
    while i < len(html):
        if html[i:i+4] == '<div':
            depth += 1
        elif html[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                end_idx = i + 6
                break
        i += 1
    else:
        print("ERROR: Could not find end of profile tab")
        return

    old_profile = html[start_idx:end_idx]
    html = html[:start_idx] + NEW_PROFILE_TAB + html[end_idx:]
    print(f"✅ Profile tab replaced ({len(old_profile)} → {len(NEW_PROFILE_TAB)} chars)")

    # --- Step 3: Fix the broken CSS syntax in dailyStatsHtml (background: rgba... 100%))  ---
    html = html.replace("background: rgba(30, 41, 59, 0.95) 100%);", "background: rgba(30, 41, 59, 0.95);")
    print("✅ Fixed CSS syntax error in dailyStatsHtml")

    # --- Step 4: Restore startStandardGeofenceScanning() if it was commented out ---
    html = html.replace(
        '      // startStandardGeofenceScanning();',
        '      startStandardGeofenceScanning();'
    )
    print("✅ Restored startStandardGeofenceScanning()")

    # --- Step 5: Keep warmUpCamera() commented (no camera prompt on load) ---
    # Already commented out from previous patches — no change needed

    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"✅ All changes written to {FILE}")
    print(f"   Total file size: {len(html):,} bytes")


if __name__ == '__main__':
    apply_redesign()
