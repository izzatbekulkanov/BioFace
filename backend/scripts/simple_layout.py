#!/usr/bin/env python3
"""
BioFace WebApp — Simple Layout Redesign
- Removes bottom nav bar and swipe track
- Adds simple top tab buttons (Asosiy | Tarix | Profil)
- Tabs switch by showing/hiding divs (no slider)
- Single scrollable page layout
"""

FILE = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────
# 1. Replace portal-view HTML (header + tab-content-container + nav)
#    The full portal-view starts at <div id="portal-view"...>
# ─────────────────────────────────────────────────────────────

# Find portal-view start
PV_OPEN = '<div id="portal-view" class="app-view active">'
pv_start = html.find(PV_OPEN)
if pv_start == -1:
    PV_OPEN = '<div id="portal-view"'
    pv_start = html.find(PV_OPEN)

# Find its matching close (walk until depth == 0)
depth = 0
i = pv_start
while i < len(html):
    if html[i:i+4] == '<div':
        depth += 1
    elif html[i:i+6] == '</div>':
        depth -= 1
        if depth == 0:
            pv_end = i + 6
            break
    i += 1

old_portal = html[pv_start:pv_end]
print(f"Portal view found: chars {pv_start}–{pv_end} ({len(old_portal)} chars)")

# ─────────────────────────────────────────────────────────────
# 2. Build new portal-view HTML
#    - Simple top header: logo | tab buttons | user info
#    - Tab content: 3 divs shown/hidden by JS
# ─────────────────────────────────────────────────────────────

# Read the HOME tab inner content (id="tab-home")
home_start_tag = '<div id="tab-home"'
home_start = html.find(home_start_tag)
home_depth = 0
j = home_start
while j < len(html):
    if html[j:j+4] == '<div':
        home_depth += 1
    elif html[j:j+6] == '</div>':
        home_depth -= 1
        if home_depth == 0:
            home_end = j + 6
            break
    j += 1
home_inner = html[home_start:home_end]

# Read the HISTORY tab inner content
hist_start_tag = '<div id="tab-history"'
hist_start = html.find(hist_start_tag)
hist_depth = 0
k = hist_start
while k < len(html):
    if html[k:k+4] == '<div':
        hist_depth += 1
    elif html[k:k+6] == '</div>':
        hist_depth -= 1
        if hist_depth == 0:
            hist_end = k + 6
            break
    k += 1
history_inner = html[hist_start:hist_end]

# Read the PROFILE tab inner content
prof_start_tag = '<div id="tab-profile"'
prof_start = html.find(prof_start_tag)
prof_depth = 0
m = prof_start
while m < len(html):
    if html[m:m+4] == '<div':
        prof_depth += 1
    elif html[m:m+6] == '</div>':
        prof_depth -= 1
        if prof_depth == 0:
            prof_end = m + 6
            break
    m += 1
profile_inner = html[prof_start:prof_end]

print(f"Home: {len(home_inner)} chars | History: {len(history_inner)} chars | Profile: {len(profile_inner)} chars")

# ─────────────────────────────────────────────────────────────
# Rewrite home inner: remove tab-view wrapper, keep content
# and fix padding (no bottom nav space needed)
# ─────────────────────────────────────────────────────────────
# The home inner already has the correct content, we just adjust padding
home_content_fixed = home_inner.replace(
    'padding-bottom: 105px',
    'padding-bottom: 24px'
).replace(
    'padding-bottom:110px',
    'padding-bottom:24px'
).replace(
    'padding-bottom: 100px',
    'padding-bottom: 24px'
)

history_content_fixed = history_inner.replace(
    'padding-bottom: 105px',
    'padding-bottom: 24px'
).replace(
    'padding-bottom: 100px',
    'padding-bottom: 24px'
)

profile_content_fixed = profile_inner.replace(
    'padding-bottom: 110px',
    'padding-bottom: 24px'
).replace(
    'padding-bottom:110px',
    'padding-bottom:24px'
)

# ─────────────────────────────────────────────────────────────
# New portal HTML — no nav bar, no slider
# ─────────────────────────────────────────────────────────────
NEW_PORTAL = f'''<div id="portal-view" class="app-view active" style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

    <!-- ── TOP HEADER ───────────────────────────────────── -->
    <header style="display:flex; flex-direction:column; background:rgba(9,14,28,0.98); border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; z-index:100;">

      <!-- Row 1: Logo + User info -->
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px 8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="/static/bioface.png" alt="Logo" style="height:26px; width:26px; object-fit:contain;" onerror="this.src='https://bioface.uz/static/bioface.png'">
          <span style="font-family:'Outfit',sans-serif; font-weight:800; font-size:16px; color:#f1f5f9; letter-spacing:.5px;">BioFace</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <img id="header-avatar" class="user-avatar" src="" alt="Avatar" style="width:30px; height:30px; border-radius:50%; border:1.5px solid #38bdf8; object-fit:cover; background:#1e293b;" onerror="this.style.display='none'">
          <div style="max-width:90px; overflow:hidden;">
            <div id="header-name" style="font-size:12px; font-weight:700; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Xodim</div>
            <div id="header-role" style="font-size:10px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">—</div>
          </div>
          <button id="btn-lang" onclick="switchLanguage(currentLang==='UZ'?'RU':'UZ')" style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); color:#38bdf8; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; cursor:pointer;">UZ</button>
        </div>
      </div>

      <!-- Row 2: Tab Switcher -->
      <div style="display:flex; padding:0 12px 8px; gap:6px;">
        <button id="tab-btn-home" onclick="switchTab('home')" style="flex:1; padding:9px 6px; border-radius:14px; border:none; background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s; border:1px solid rgba(56,189,248,0.25);">
          <svg style="width:14px; height:14px; vertical-align:middle; margin-right:4px; fill:currentColor;" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span id="nav-lbl-home">Asosiy</span>
        </button>
        <button id="tab-btn-history" onclick="switchTab('history')" style="flex:1; padding:9px 6px; border-radius:14px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.04); color:#64748b; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s;">
          <svg style="width:14px; height:14px; vertical-align:middle; margin-right:4px; fill:currentColor;" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
          <span id="nav-lbl-history">Tarix</span>
        </button>
        <button id="tab-btn-profile" onclick="switchTab('profile')" style="flex:1; padding:9px 6px; border-radius:14px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.04); color:#64748b; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s;">
          <svg style="width:14px; height:14px; vertical-align:middle; margin-right:4px; fill:currentColor;" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
          <span id="nav-lbl-profile">Profil</span>
        </button>
      </div>
    </header>

    <!-- ── TAB CONTENT: single scrollable area ────────── -->
    <div style="flex:1; overflow:hidden; position:relative;">

      <!-- HOME TAB -->
      <div id="tab-home" style="position:absolute; inset:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; display:block;">
        <!-- Loading skeleton -->
        <div id="home-skeleton-loader" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="glass-card" style="height:80px; padding:14px; display:flex; flex-direction:column; gap:8px;">
              <div class="skeleton-block" style="width:45px; height:11px;"></div>
              <div class="skeleton-block" style="width:70px; height:22px;"></div>
            </div>
            <div class="glass-card" style="height:80px; padding:14px; display:flex; flex-direction:column; gap:8px;">
              <div class="skeleton-block" style="width:45px; height:11px;"></div>
              <div class="skeleton-block" style="width:70px; height:22px;"></div>
            </div>
          </div>
          <div class="glass-card" style="height:60px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
            <div class="skeleton-block" style="width:32px; height:32px; border-radius:50%;"></div>
            <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
              <div class="skeleton-block" style="width:130px; height:12px;"></div>
              <div class="skeleton-block" style="width:180px; height:10px;"></div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="glass-card" style="height:100px;"></div>
            <div class="glass-card" style="height:100px;"></div>
          </div>
        </div>

        <!-- Actual home content -->
        <div id="home-actual-content" style="display:none; flex-direction:column; gap:0;">

          <!-- Date row -->
          <div style="margin-bottom:16px;">
            <div id="home-date" style="font-family:'Outfit',sans-serif; font-size:20px; font-weight:800; color:#f1f5f9;">Bugun</div>
            <div id="home-day" style="font-size:12px; color:#64748b; margin-top:2px;">Dushanba</div>
          </div>

          <!-- Check In/Out time cards -->
          <div class="clock-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div class="glass-card clock-card in" style="text-align:center; padding:16px;">
              <div class="clock-label" id="lbl-time-in" style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px;">Kelish</div>
              <div id="home-time-in" class="clock-time" style="font-family:'Outfit',sans-serif; font-size:26px; font-weight:800; letter-spacing:-1px;">--:--</div>
              <div id="home-expected-in" class="clock-expected" style="font-size:11px; color:#64748b; margin-top:4px;">--:--</div>
            </div>
            <div class="glass-card clock-card out" style="text-align:center; padding:16px;">
              <div class="clock-label" id="lbl-time-out" style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px;">Chiqish</div>
              <div id="home-time-out" class="clock-time" style="font-family:'Outfit',sans-serif; font-size:26px; font-weight:800; letter-spacing:-1px;">--:--</div>
              <div id="home-expected-out" class="clock-expected" style="font-size:11px; color:#64748b; margin-top:4px;">--:--</div>
            </div>
          </div>

          <!-- Geofence status -->
          <div class="glass-card geofence-card" style="display:flex; align-items:center; gap:14px; padding:14px 16px; margin-bottom:16px; border-radius:18px;">
            <div class="radar-container" style="width:40px; height:40px; border-radius:50%; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.15); display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; flex-shrink:0;">
              <div class="radar-circle" style="position:absolute; border-radius:50%; border:1px solid #38bdf8; animation:radarScan 2.5s infinite linear; opacity:0;"></div>
              <svg style="width:18px; height:18px; fill:#38bdf8;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>
            <div>
              <div id="geofence-status-title" style="font-size:13px; font-weight:700; color:#f1f5f9;">Geolokatsiya tekshirilmoqda...</div>
              <div id="geofence-status-desc" style="font-size:11px; color:#64748b; margin-top:2px;">Hudud koordinatalarini olish</div>
            </div>
          </div>

          <!-- Check In / Out buttons -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
            <button id="btn-checkin-in" class="action-btn-large in" style="border-radius:20px; padding:20px 10px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; border:1.5px solid rgba(16,185,129,0.25); background:linear-gradient(145deg,rgba(16,185,129,0.15),rgba(16,185,129,0.06));">
              <svg viewBox="0 0 24 24" style="width:28px; height:28px; fill:none; stroke:#10b981; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              <span class="action-btn-title" id="btn-checkin-in-lbl" style="font-weight:700; font-size:13px;">Kirish</span>
              <span class="action-btn-sub" id="btn-checkin-in-sub" style="font-size:10px; opacity:.65; text-align:center; line-height:1.3;">Check In</span>
            </button>
            <button id="btn-checkin-out" class="action-btn-large" style="border-radius:20px; padding:20px 10px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; border:1.5px solid rgba(56,189,248,0.25); background:linear-gradient(145deg,rgba(56,189,248,0.15),rgba(56,189,248,0.06));">
              <svg viewBox="0 0 24 24" style="width:28px; height:28px; fill:none; stroke:#38bdf8; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              <span class="action-btn-title" id="btn-checkin-out-lbl" style="font-weight:700; font-size:13px;">Chiqish</span>
              <span class="action-btn-sub" id="btn-checkin-out-sub" style="font-size:10px; opacity:.65; text-align:center; line-height:1.3;">Check Out</span>
            </button>
          </div>

          <!-- Monthly stats -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div id="lbl-stats-section-title" style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.8px;">Joriy oy statistikasi</div>
            <div id="lbl-stats-section-month" style="font-size:11px; color:#475569;">—</div>
          </div>
          <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
            <div class="glass-card stat-card present" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(16,185,129,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#10b981; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-present" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Kelgan</span>
                <span class="stat-value" id="val-stat-present" style="font-size:14px; font-weight:800; color:#10b981;">0 kun</span>
              </div>
            </div>
            <div class="glass-card stat-card absent" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(239,68,68,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#ef4444; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="18"/><line x1="14" y1="14" x2="10" y2="18"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-absent" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Kelmagan</span>
                <span class="stat-value" id="val-stat-absent" style="font-size:14px; font-weight:800; color:#ef4444;">0 kun</span>
              </div>
            </div>
            <div class="glass-card stat-card expected" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(56,189,248,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#38bdf8; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-expected" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Ishlash kerak</span>
                <span class="stat-value" id="val-stat-expected" style="font-size:14px; font-weight:800; color:#38bdf8;">0 soat</span>
              </div>
            </div>
            <div class="glass-card stat-card missed" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(245,158,11,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#f59e0b; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-missed" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Ishlamagan</span>
                <span class="stat-value" id="val-stat-missed" style="font-size:14px; font-weight:800; color:#f59e0b;">0 soat</span>
              </div>
            </div>
            <div class="glass-card stat-card late-count" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(244,63,94,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#f43f5e; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 15"/><path d="M5 3L2 6M19 3l3 3M12 2v1"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-late-count" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Kech qolgan</span>
                <span class="stat-value" id="val-stat-late-count" style="font-size:14px; font-weight:800; color:#f43f5e;">0 marta</span>
              </div>
            </div>
            <div class="glass-card stat-card late-dur" style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:16px; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.05);">
              <span class="stat-icon" style="width:34px; height:34px; border-radius:10px; background:rgba(168,85,247,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:#a855f7; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <div class="stat-content" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                <span class="stat-label" id="lbl-stat-late-dur" style="font-size:9px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.3px;">Kechikish davri</span>
                <span class="stat-value" id="val-stat-late-dur" style="font-size:14px; font-weight:800; color:#a855f7;">0 daq</span>
              </div>
            </div>
          </div>

          <!-- Today logs section -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div id="lbl-today-logs" style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.8px;">Bugungi qaydlar</div>
          </div>
          <div id="home-logs-list" class="history-list" style="display:flex; flex-direction:column; gap:10px; padding-bottom:20px;"></div>

        </div><!-- /home-actual-content -->
      </div><!-- /tab-home -->

      <!-- HISTORY TAB -->
      <div id="tab-history" style="position:absolute; inset:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; display:none;">
        <!-- skeleton -->
        <div id="history-skeleton-loader" style="display:flex; flex-direction:column; gap:10px;">
          <div class="glass-card" style="height:56px;"></div>
          <div class="glass-card" style="height:56px;"></div>
          <div class="glass-card" style="height:56px;"></div>
        </div>

        <div id="history-actual-content" style="display:none; flex-direction:column;">
          <!-- Month nav -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <button onclick="changeCalendarMonth(-1)" style="width:36px; height:36px; border-radius:12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div id="lbl-history-title" style="font-family:'Outfit',sans-serif; font-size:17px; font-weight:800; color:#f1f5f9;">—</div>
            <button onclick="changeCalendarMonth(1)" style="width:36px; height:36px; border-radius:12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Calendar grid -->
          <div id="calendar-grid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:16px;"></div>

          <!-- Selected day logs -->
          <div id="selected-day-section" style="display:none;">
            <div id="lbl-selected-day-title" style="font-size:13px; font-weight:700; color:#64748b; margin-bottom:10px;"></div>
            <div id="selected-day-logs" class="history-list" style="display:flex; flex-direction:column; gap:10px;"></div>
          </div>
        </div>
      </div><!-- /tab-history -->

      <!-- PROFILE TAB -->
      <div id="tab-profile" style="position:absolute; inset:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; display:none; background:var(--bf-bg,#020617);">

        <!-- Hero Card -->
        <div style="position:relative; background:linear-gradient(160deg,#0f172a 0%,#1e293b 100%); border-radius:24px; border:1px solid rgba(255,255,255,0.07); overflow:hidden; padding:24px 18px 20px; text-align:center; margin-bottom:16px; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
          <div style="position:absolute; top:-40px; right:-40px; width:120px; height:120px; background:#38bdf8; border-radius:50%; opacity:0.05; pointer-events:none;"></div>
          <!-- Avatar -->
          <div style="position:relative; width:88px; height:88px; margin:0 auto 14px;">
            <div style="width:100%; height:100%; border-radius:50%; padding:3px; background:linear-gradient(135deg,#38bdf8,#a855f7,#ec4899);">
              <div id="profile-avatar-container" style="width:100%; height:100%; border-radius:50%; overflow:hidden; background:#0f172a;">
                <img id="profile-avatar" src="https://www.w3schools.com/howto/img_avatar.png" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">
              </div>
            </div>
            <div id="profile-avatar-camera-badge" onclick="openAvatarEditor()" style="display:none; position:absolute; bottom:-2px; right:-2px; width:28px; height:28px; background:linear-gradient(135deg,#ec4899,#f43f5e); border-radius:50%; align-items:center; justify-content:center; border:3px solid #0f172a; cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          </div>
          <h2 id="profile-name" style="font-size:20px; font-weight:800; color:#f1f5f9; margin:0 0 6px; line-height:1.2;">—</h2>
          <div style="display:inline-flex; align-items:center; gap:5px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); padding:4px 12px; border-radius:20px;">
            <span id="profile-role" style="font-size:12px; color:#38bdf8; font-weight:600;">—</span>
          </div>
          <button id="btn-profile-change-avatar" onclick="openAvatarEditor()" style="display:none; margin-top:14px; width:100%; background:linear-gradient(135deg,#38bdf8,#0ea5e9); border:none; border-radius:14px; padding:11px; color:#fff; font-weight:700; font-size:13px; cursor:pointer;">Rasmni yangilash</button>
        </div>

        <!-- Info grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.05); border-radius:20px; padding:14px;">
            <div style="width:36px; height:36px; border-radius:11px; background:rgba(56,189,248,0.12); display:flex; align-items:center; justify-content:center; margin-bottom:8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div style="font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.4px; margin-bottom:3px;" id="lbl-prof-dept">Bo'lim</div>
            <div id="profile-dept-val" style="font-size:13px; color:#f1f5f9; font-weight:700; line-height:1.3; word-break:break-word;">—</div>
          </div>
          <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.05); border-radius:20px; padding:14px;">
            <div style="width:36px; height:36px; border-radius:11px; background:rgba(168,85,247,0.12); display:flex; align-items:center; justify-content:center; margin-bottom:8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <div style="font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.4px; margin-bottom:3px;" id="lbl-prof-pos">Lavozim</div>
            <div id="profile-pos-val" style="font-size:13px; color:#f1f5f9; font-weight:700; line-height:1.3; word-break:break-word;">—</div>
          </div>
        </div>

        <!-- Details list -->
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.05); border-radius:22px; overflow:hidden; margin-bottom:16px;">
          <div style="display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(251,146,60,0.12); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:10px; color:#64748b; font-weight:500; margin-bottom:1px;">Personal ID</div>
              <div id="profile-id-val" style="font-size:13px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(16,185,129,0.12); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:10px; color:#64748b; font-weight:500; margin-bottom:1px;">Telefon</div>
              <div id="profile-phone-val" style="font-size:13px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(236,72,153,0.12); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:10px; color:#64748b; font-weight:500; margin-bottom:1px;">Ish vaqti</div>
              <div id="profile-time-val" style="font-size:13px; color:#f1f5f9; font-weight:700;">—</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(99,102,241,0.12); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:10px; color:#64748b; font-weight:500; margin-bottom:1px;">Filial</div>
              <div id="profile-branch-val" style="font-size:13px; color:#f1f5f9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">—</div>
            </div>
          </div>
          <div id="row-profile-salary" style="display:none; align-items:center; padding:14px 16px;">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(16,185,129,0.12); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:10px; color:#64748b; font-weight:500; margin-bottom:1px;">Oylik maosh</div>
              <div id="profile-salary-val" style="font-size:16px; color:#10b981; font-weight:800; letter-spacing:-.5px;">—</div>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.05); border-radius:22px; overflow:hidden; margin-bottom:20px;">
          <div onclick="switchLanguage(currentLang==='UZ'?'RU':'UZ')" style="display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer;">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(148,163,184,0.1); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div style="flex:1;"><div style="font-size:14px; color:#f1f5f9; font-weight:600;">Tilni o'zgartirish</div></div>
            <span id="current-lang-indicator" style="font-size:13px; font-weight:800; color:#38bdf8; margin-right:6px;">UZ</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div onclick="logout()" style="display:flex; align-items:center; padding:14px 16px; cursor:pointer;">
            <div style="width:32px; height:32px; border-radius:10px; background:rgba(239,68,68,0.1); display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <div style="flex:1;"><div style="font-size:14px; color:#ef4444; font-weight:600;">Hisobdan chiqish</div></div>
          </div>
        </div>
      </div><!-- /tab-profile -->

    </div><!-- /tab-content wrapper -->
  </div>
'''

html = html[:pv_start] + NEW_PORTAL + html[pv_end:]
print(f"New portal: {len(NEW_PORTAL):,} chars")

# ─────────────────────────────────────────────────────────────
# 3. Fix switchTab() to use show/hide instead of slider
# ─────────────────────────────────────────────────────────────
OLD_SWITCH_TAB_PATTERN = 'function switchTab(tabId) {'
st_start = html.find(OLD_SWITCH_TAB_PATTERN)
if st_start != -1:
    # find the end of this function
    depth = 0
    i = st_start
    while i < len(html):
        if html[i] == '{':
            depth += 1
        elif html[i] == '}':
            depth -= 1
            if depth == 0:
                st_end = i + 1
                break
        i += 1
    
    new_switch_tab = '''function switchTab(tabId) {
      const tabs = ['home', 'history', 'profile'];
      tabs.forEach(t => {
        const el = document.getElementById('tab-' + t);
        const btn = document.getElementById('tab-btn-' + t);
        if (el) el.style.display = (t === tabId) ? 'block' : 'none';
        if (btn) {
          if (t === tabId) {
            btn.style.background = 'rgba(56,189,248,0.15)';
            btn.style.color = '#38bdf8';
            btn.style.border = '1px solid rgba(56,189,248,0.25)';
          } else {
            btn.style.background = 'rgba(255,255,255,0.04)';
            btn.style.color = '#64748b';
            btn.style.border = '1px solid rgba(255,255,255,0.07)';
          }
        }
      });
      // Update language button indicator
      const li = document.getElementById('current-lang-indicator');
      if (li) li.innerText = currentLang || 'UZ';
      // Lazy-load data when switching
      if (tabId === 'home' && !isHomeDataCached && employeeData) {
        fetchDashboardStats();
        fetchTodayTimeLogs();
      }
      if (tabId === 'history' && employeeData) {
        loadHistoryList();
      }
    }'''
    
    html = html[:st_start] + new_switch_tab + html[st_end:]
    print("✅ switchTab() replaced with simple show/hide")
else:
    print("⚠️  switchTab not found, skipping")

# ─────────────────────────────────────────────────────────────
# 4. Fix updateNavIndicator() — disable it (no nav bar)
# ─────────────────────────────────────────────────────────────
UNI_PATTERN = 'function updateNavIndicator() {'
uni_start = html.find(UNI_PATTERN)
if uni_start != -1:
    depth = 0
    i = uni_start
    while i < len(html):
        if html[i] == '{':
            depth += 1
        elif html[i] == '}':
            depth -= 1
            if depth == 0:
                uni_end = i + 1
                break
        i += 1
    html = html[:uni_start] + 'function updateNavIndicator() { /* no-op: bottom nav removed */ }' + html[uni_end:]
    print("✅ updateNavIndicator() no-op'd")

# ─────────────────────────────────────────────────────────────
# 5. Fix showHomeSkeleton / hideHomeSkeleton to reference new IDs
# ─────────────────────────────────────────────────────────────
html = html.replace(
    "document.getElementById('home-skeleton-loader')",
    "document.getElementById('home-skeleton-loader')"
)  # already correct

# ─────────────────────────────────────────────────────────────
# 6. Remove the old standalone <nav class="nav-bar">...</nav>
#    if it still exists outside portal-view
# ─────────────────────────────────────────────────────────────
import re
html = re.sub(r'\s*<!-- Navigation Bar -->\s*<nav class="nav-bar">.*?</nav>', '', html, flags=re.DOTALL)
print("✅ Old nav bar removed")

# ─────────────────────────────────────────────────────────────
# 7. Remove setupSwipeGestures call (no swipe needed)
# ─────────────────────────────────────────────────────────────
html = html.replace('setupSwipeGestures();', '// setupSwipeGestures(); // disabled: no swipe nav')
print("✅ setupSwipeGestures disabled")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"\n✅ Simple layout applied. File size: {len(html):,} bytes")
