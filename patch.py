import json
import re

with open('routers/pages.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we don't apply it multiple times
if '"middleware_logs": "Tizim Loglari"' not in content:
    content = content.replace('"api_helper": "API Helper",\n        "redis_monitor": "REDIS",\n    },\n    "ru":', '"api_helper": "API Helper",\n        "redis_monitor": "REDIS",\n        "middleware_logs": "Tizim Loglari",\n    },\n    "ru":')
    content = content.replace('"api_helper": "API Helper",\n        "redis_monitor": "REDIS",\n    }\n}', '"api_helper": "API Helper",\n        "redis_monitor": "REDIS",\n        "middleware_logs": "Системные Логи",\n    }\n}')

    new_item = '    {"type": "link", "key": "middleware_logs", "href": "/middleware-logs", "icon": \'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>\'},\n    {"type": "link", "key": "api_helper"'
    content = content.replace('    {"type": "link", "key": "api_helper"', new_item)

    content = content.replace('"isup_server": "ISUP Server" if lang == "uz" else "ISUP Сервер"\n    }', '"isup_server": "ISUP Server" if lang == "uz" else "ISUP Сервер",\n        "middleware_logs": "Tizim Loglari" if lang == "uz" else "Системные Логи"\n    }')

    content = content.replace('("ISUP Server" if key == "isup_server" else ("Kameralar"', '("ISUP Server" if key == "isup_server" else ("Tizim Loglari" if key == "middleware_logs" else ("Kameralar"')
    content = content.replace('users" else "Tashkilotlar"))))))))))))', 'users" else "Tashkilotlar")))))))))))))')

    content = content.replace('("ISUP Сервер" if key == "isup_server" else ("Камеры"', '("ISUP Сервер" if key == "isup_server" else ("Системные Логи" if key == "middleware_logs" else ("Камеры"')
    content = content.replace('users" else "Организации"))))))))))))', 'users" else "Организации")))))))))))))')

    with open('routers/pages.py', 'w', encoding='utf-8') as f:
        f.write(content)
