import threading
import httpx
from pathlib import Path
from typing import Optional
from database import SessionLocal
from models import Employee, User, FaceEmbedding

AI_SERVICE_URL = "http://127.0.0.1:7690"
BACKEND_DIR = Path(__file__).resolve().parent.parent


def _resolve_static_path(image_url: str) -> str:
    return str(BACKEND_DIR / str(image_url or "").lstrip("/"))

def _run_embedding_generation(employee_id: Optional[int], user_id: Optional[int]):
    db = SessionLocal()
    try:
        if employee_id:
            emp = db.query(Employee).filter(Employee.id == employee_id).first()
            if not emp or not emp.image_url or not emp.image_url.strip():
                # Clean up existing embedding if photo is removed
                existing = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == employee_id).first()
                if existing:
                    db.delete(existing)
                    db.commit()
                return
            abs_path = _resolve_static_path(emp.image_url)
            
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
            if not usr or not usr.image_url or not usr.image_url.strip():
                # Clean up existing embedding if photo is removed
                existing = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user_id).first()
                if existing:
                    db.delete(existing)
                    db.commit()
                return
            abs_path = _resolve_static_path(usr.image_url)
            
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


def cleanup_stale_embeddings(db) -> int:
    """
    Deletes any FaceEmbedding records where the linked Employee or User has no photo (image_url).
    """
    deleted_count = 0
    try:
        # Clean employee embeddings
        embeddings = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id.isnot(None)).all()
        for emb in embeddings:
            emp = db.query(Employee).filter(Employee.id == emb.employee_id).first()
            if not emp or not emp.image_url or not emp.image_url.strip():
                db.delete(emb)
                deleted_count += 1
                
        # Clean user embeddings
        user_embeddings = db.query(FaceEmbedding).filter(FaceEmbedding.user_id.isnot(None)).all()
        for emb in user_embeddings:
            usr = db.query(User).filter(User.id == emb.user_id).first()
            if not usr or not usr.image_url or not usr.image_url.strip():
                db.delete(emb)
                deleted_count += 1
                
        if deleted_count > 0:
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[CLEANUP EMBEDDINGS] Error during self-healing cleanup: {e}")
    return deleted_count


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
