import os
import threading
import httpx
from typing import Optional
from database import SessionLocal
from models import Employee, User, FaceEmbedding

AI_SERVICE_URL = "http://127.0.0.1:7690"

def _run_embedding_generation(employee_id: Optional[int], user_id: Optional[int]):
    db = SessionLocal()
    try:
        if employee_id:
            emp = db.query(Employee).filter(Employee.id == employee_id).first()
            if not emp or not emp.image_url:
                return
            rel_path = emp.image_url.lstrip("/")
            abs_path = os.path.join('/home/smartgate/BioFace/backend', rel_path)
            
            # Call AI microservice
            try:
                res = httpx.post(
                    f"{AI_SERVICE_URL}/generate-embedding",
                    json={"image_path": abs_path},
                    timeout=15.0
                )
                if res.status_code == 200:
                    data = res.json()
                    if data.get("ok"):
                        emb = data["embedding"]
                        conf = data["confidence"]
                        existing = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == employee_id).first()
                        if existing:
                            existing.embedding_data = emb
                            existing.confidence = conf
                            existing.model_version = "insightface_buffalo_l_service"
                        else:
                            new_emb = FaceEmbedding(
                                employee_id=employee_id,
                                embedding_data=emb,
                                confidence=conf,
                                model_version="insightface_buffalo_l_service"
                            )
                            db.add(new_emb)
                        db.commit()
            except Exception as e:
                print(f"[AI SERVICE EMBEDDING] Error for employee {employee_id}: {e}")
                
        elif user_id:
            usr = db.query(User).filter(User.id == user_id).first()
            if not usr or not usr.image_url:
                return
            rel_path = usr.image_url.lstrip("/")
            abs_path = os.path.join('/home/smartgate/BioFace/backend', rel_path)
            
            # Call AI microservice
            try:
                res = httpx.post(
                    f"{AI_SERVICE_URL}/generate-embedding",
                    json={"image_path": abs_path},
                    timeout=15.0
                )
                if res.status_code == 200:
                    data = res.json()
                    if data.get("ok"):
                        emb = data["embedding"]
                        conf = data["confidence"]
                        existing = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user_id).first()
                        if existing:
                            existing.embedding_data = emb
                            existing.confidence = conf
                            existing.model_version = "insightface_buffalo_l_service"
                        else:
                            new_emb = FaceEmbedding(
                                user_id=user_id,
                                embedding_data=emb,
                                confidence=conf,
                                model_version="insightface_buffalo_l_service"
                            )
                            db.add(new_emb)
                        db.commit()
            except Exception as e:
                print(f"[AI SERVICE EMBEDDING] Error for user {user_id}: {e}")
                
    finally:
        db.close()


def trigger_embedding_generation_bg(employee_id: Optional[int] = None, user_id: Optional[int] = None):
    """
    Triggers face embedding generation asynchronously by delegating to the AI microservice.
    Runs in a background thread to prevent blocking main request-response cycle.
    """
    if not employee_id and not user_id:
        return
    thread = threading.Thread(
        target=_run_embedding_generation,
        args=(employee_id, user_id),
        daemon=True
    )
    thread.start()
