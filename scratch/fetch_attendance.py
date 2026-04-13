import sys
sys.path.insert(0, '/home/admin/BioFace')
from database import SessionLocal
from routers.cameras import get_attendance_groups

class DummyRequest:
    session = {"auth_user": {"organization_id": None, "role": "admin"}}
    
db = SessionLocal()
try:
    req = DummyRequest()
    res = get_attendance_groups(
        request=req,
        page=1,
        page_size=15,
        db=db
    )
    print("Success:", isinstance(res, dict))
    print("Items:", len(res.get("items", [])))
    if not res.get("items"):
        print("Empty items!")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
