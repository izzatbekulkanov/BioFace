import sys

def redesign_webapp():
    file_path = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Remove auto-prompts for Camera and Location on App Load
    for i in range(len(lines)):
        if "warmUpCamera();" in lines[i] and "function " not in lines[i] and "//" not in lines[i]:
            lines[i] = lines[i].replace("warmUpCamera();", "// warmUpCamera(); removed to stop auto-prompt")
        
        # Only remove startStandardGeofenceScanning from initTelegramApp, not the recursive handler inside itself.
        if "startStandardGeofenceScanning();" in lines[i] and "//" not in lines[i]:
            # we know it's around line 5872 for initTelegramApp
            # Let's just comment all of them except the one inside startStandardGeofenceScanning itself.
            pass

    # Actually, it's easier to just do it via string replacement on the whole text
    content = "".join(lines)
    
    content = content.replace("warmUpCamera();", "// warmUpCamera();")
    content = content.replace("// // warmUpCamera();", "// warmUpCamera();")
    
    # Put warmUpCamera back where it should be (the function declaration and maybe recursive call)
    content = content.replace("// warmUpCamera(); removed to stop auto-prompt", "// warmUpCamera();")
    
    # Fix openCamera
    open_camera_inject = """function openCamera(direction) {
      // PRO FIX: Request location ONLY when checking in to avoid annoying app-load prompts
      if (_geoWatchId === null) startStandardGeofenceScanning();
"""
    content = content.replace('function openCamera(direction) {', open_camera_inject)
    
    # Stop startStandardGeofenceScanning from firing on load.
    # It is called inside `checkAuth` or `initTelegramApp`.
    # Let's just find `startStandardGeofenceScanning();` which has indentation of 6 spaces (inside initTelegramApp)
    content = content.replace('      startStandardGeofenceScanning();', '      // startStandardGeofenceScanning();')

    # 2. Redesign the Profile Tab to be PRO Level
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if '<div id="tab-profile"' in line:
            start_idx = i
            break
            
    if start_idx != -1:
        depth = 0
        for i in range(start_idx, len(lines)):
            if '<div' in lines[i]:
                depth += lines[i].count('<div')
            if '</div' in lines[i]:
                depth -= lines[i].count('</div')
            if depth == 0:
                end_idx = i
                break
                
        if end_idx != -1:
            old_html_lines = lines[start_idx:end_idx+1]
            old_html = "".join(old_html_lines)
            
            pro_profile_html = """<div id="tab-profile" class="tab-view" style="padding: 20px 16px; padding-bottom: 120px; overflow-y: auto; background: var(--bg-color);">
        
        <!-- Premium Header Area -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 0 4px;">
            <h2 style="font-size: 28px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.5px;">Profil</h2>
            <div class="glass-card" style="padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2);">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 10px #38bdf8; animation: pulse 2s infinite;"></div>
                <span style="font-size: 13px; font-weight: 600; color: #38bdf8;">Faol</span>
            </div>
        </div>

        <!-- Hero Card (Avatar & Main Info) -->
        <div class="glass-card profile-hero-card" style="position: relative; padding: 30px 20px; border-radius: 28px; text-align: center; margin-bottom: 24px; background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden;">
            
            <!-- Abstract background decorations -->
            <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--accent); opacity: 0.15; filter: blur(40px); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: -30px; left: -30px; width: 100px; height: 100px; background: #a855f7; opacity: 0.15; filter: blur(40px); border-radius: 50%;"></div>

            <!-- Avatar -->
            <div style="position: relative; width: 110px; height: 110px; margin: 0 auto 20px auto; z-index: 2;">
                <div class="profile-avatar-ring" style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #38bdf8, #a855f7, #ec4899); padding: 4px; box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.4);">
                    <div id="profile-avatar-container" style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0f172a; position: relative;">
                        <img id="profile-avatar" src="https://www.w3schools.com/howto/img_avatar.png" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
                <!-- Camera Badge -->
                <div id="profile-avatar-camera-badge" onclick="openAvatarEditor()" class="pulse" style="display: none; position: absolute; bottom: 0; right: -5px; width: 36px; height: 36px; background: linear-gradient(135deg, #ec4899, #f43f5e); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #1e293b; cursor: pointer; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.5);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                </div>
            </div>

            <!-- User Name & Role -->
            <h2 id="profile-name" style="font-size: 24px; font-weight: 800; color: #fff; margin: 0 0 8px 0; z-index: 2; position: relative;">Xodim Ismi</h2>
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); z-index: 2; position: relative;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span id="profile-role" style="font-size: 13px; color: #e2e8f0; font-weight: 500; letter-spacing: 0.5px;">Mutaxassis</span>
            </div>
            <button id="btn-profile-change-avatar" onclick="openAvatarEditor()" class="btn-primary" style="display: none; margin-top: 16px; width: 100%; border-radius: 16px; padding: 12px; font-weight: 600; font-size: 14px; z-index: 2; position: relative; background: linear-gradient(135deg, var(--accent), #4f46e5);">Suratni yangilash</button>
        </div>

        <!-- Main Info Grid (2 Columns) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <!-- Department Card -->
            <div class="glass-card" style="padding: 16px; border-radius: 24px; display: flex; flex-direction: column; justify-content: center; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.04);">
                <div style="width: 40px; height: 40px; border-radius: 14px; background: rgba(56, 189, 248, 0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
                <span id="lbl-prof-dept" style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">Bo'lim</span>
                <span id="profile-dept-val" style="font-size: 15px; color: #fff; font-weight: 700; line-height: 1.2;">-</span>
            </div>

            <!-- Position Card -->
            <div class="glass-card" style="padding: 16px; border-radius: 24px; display: flex; flex-direction: column; justify-content: center; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.04);">
                <div style="width: 40px; height: 40px; border-radius: 14px; background: rgba(168, 85, 247, 0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                </div>
                <span id="lbl-prof-pos" style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">Lavozim</span>
                <span id="profile-pos-val" style="font-size: 15px; color: #fff; font-weight: 700; line-height: 1.2;">-</span>
            </div>
        </div>

        <!-- Detailed List Items -->
        <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 12px 4px;">Shaxsiy Ma'lumotlar</h3>
        <div class="glass-card" style="padding: 0; border-radius: 24px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 24px;">
            
            <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(251, 146, 60, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">Personal ID</div>
                    <div id="profile-id-val" style="font-size: 15px; color: #fff; font-weight: 600;">-</div>
                </div>
            </div>

            <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">Telefon raqami</div>
                    <div id="profile-phone-val" style="font-size: 15px; color: #fff; font-weight: 600;">-</div>
                </div>
            </div>

            <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(236, 72, 153, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">Ish vaqti</div>
                    <div id="profile-time-val" style="font-size: 15px; color: #fff; font-weight: 600;">-</div>
                </div>
            </div>

            <div style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(99, 102, 241, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">Filial</div>
                    <div id="profile-branch-val" style="font-size: 15px; color: #fff; font-weight: 600;">-</div>
                </div>
            </div>

            <div id="row-profile-salary" style="display: none; align-items: center; padding: 16px 20px;">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">Oylik maosh</div>
                    <div id="profile-salary-val" style="font-size: 18px; color: #10b981; font-weight: 800; letter-spacing: -0.5px;">-</div>
                </div>
            </div>
        </div>

        <!-- System Settings Section -->
        <h3 style="font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 12px 4px;">Tizim sozlamalari</h3>
        <div class="glass-card" style="padding: 0; border-radius: 24px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 24px;">
            
            <div class="list-item-action" onclick="switchLanguage(currentLang === 'UZ' ? 'RU' : 'UZ')" style="display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.2s;">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(148, 163, 184, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 15px; color: #fff; font-weight: 600;">Tilni o'zgartirish</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span id="current-lang-indicator" style="font-size: 14px; font-weight: 700; color: var(--accent);">UZ</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>

            <div class="list-item-action" onclick="logout()" style="display: flex; align-items: center; padding: 16px 20px; cursor: pointer; transition: background 0.2s;">
                <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 15px; color: #ef4444; font-weight: 600;">Hisobdan chiqish</div>
                </div>
            </div>
            
        </div>
      </div>\n"""
            
            content = content.replace(old_html, pro_profile_html)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("✅ Redesign applied successfully.")
        else:
            print("❌ End tag not found")
    else:
        print("❌ Could not find tab-profile block.")

if __name__ == "__main__":
    redesign_webapp()
