import sys

def fix_webapp_breakage():
    file_path = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Restore startStandardGeofenceScanning() on load so geofence check works
    content = content.replace('      // startStandardGeofenceScanning();', '      startStandardGeofenceScanning();')
    
    # But do NOT restore warmUpCamera(), keep it commented out to prevent camera prompt on load

    # 2. Fix the invalid CSS syntax error in dailyStatsHtml
    content = content.replace('background: rgba(30, 41, 59, 0.95) 100%);', 'background: rgba(30, 41, 59, 0.95);')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("✅ WebApp fixes applied. Geofencing restored, invalid CSS fixed.")

if __name__ == "__main__":
    fix_webapp_breakage()
