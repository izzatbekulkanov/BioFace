import sys
sys.path.insert(0, '/home/admin/BioFace')
from database import SessionLocal
from routers.cameras import get_attendance_groups
from time_utils import now_tashkent

db = SessionLocal()
class DummyReq:
    session = {"auth_user": {"organization_id": 2, "role": "admin"}}
    
try:
    res = get_attendance_groups(
        request=DummyReq(),
        page=1,
        page_size=15,
        today_status="came",
        db=db
    )
    import json
    print(json.dumps(res, indent=2, default=str)[:1000])
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
