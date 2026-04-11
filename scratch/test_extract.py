import sqlite3
c = sqlite3.connect('bioface.db')
c.row_factory = sqlite3.Row
rows = c.execute("SELECT id, name, is_online, ip_address, isup_device_id FROM devices WHERE is_online > 0").fetchall()
for r in rows:
    print(dict(r))
