from pathlib import Path
content = Path("/Users/macbookpro/Documents/GitHub/BioFace/routers/pages.py").read_text()

replacements = {
    "dashboard": "fa-solid fa-chart-pie",
    "devices": "fa-solid fa-camera-cctv",
    "commands": "fa-solid fa-terminal",
    "staff": "fa-solid fa-user-tie",
    "students": "fa-solid fa-user-graduate",
    "shifts": "fa-solid fa-calendar-clock",
    "attendance": "fa-solid fa-list-check",
    "psychological_portrait": "fa-solid fa-brain",
    "reports": "fa-solid fa-file-chart-column",
    "organizations": "fa-solid fa-building",
    "users": "fa-solid fa-users-gear",
    "user_approvals": "fa-solid fa-user-clock",
    "settings": "fa-solid fa-gear",
    "isup_server": "fa-solid fa-server",
    "redis_monitor": "fa-solid fa-database",
    "middleware_logs": "fa-solid fa-rectangle-history",
    "api_helper": "fa-solid fa-code-merge",
    "about": "fa-solid fa-circle-question"
}

import re
# DEFAULT_MENU_STRUCTURE = [ ... ]
for key, fa_class in replacements.items():
    # regex to replace "icon": '<path ...>' with "icon": 'fa-solid fa-...'
    pattern = r'("key": "' + key + r'",.*?)"icon": \'<path.*?>\''
    content = re.sub(pattern, r'\1"icon": "' + fa_class + r'"', content, flags=re.DOTALL)
    
Path("/Users/macbookpro/Documents/GitHub/BioFace/routers/pages.py").write_text(content)
print("Pages patched.")
