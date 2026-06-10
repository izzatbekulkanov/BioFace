import os
import sys
import argparse

# Add BioFace backend path to python path
sys.path.insert(0, '/home/smartgate/BioFace/backend')

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from core.database import SessionLocal
from models import Employee, User, FaceEmbedding

import onnxruntime

# Initialize InsightFace buffalo_l model
print("[INSIGHTFACE] Loading model buffalo_l...")
app = None
available = onnxruntime.get_available_providers()

if "CUDAExecutionProvider" in available:
    try:
        print("[INSIGHTFACE] GPU detected. Trying CUDAExecutionProvider...")
        app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        print("[INSIGHTFACE] Successfully loaded buffalo_l using GPU (CUDA).")
    except Exception as e:
        print(f"[INSIGHTFACE] Failed to initialize GPU provider: {e}. Falling back to CPU...")
        app = None

if app is None:
    print("[INSIGHTFACE] Using CPUExecutionProvider...")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("[INSIGHTFACE] Successfully loaded buffalo_l using CPU.")

def get_face_embedding(image_path: str):
    if not os.path.exists(image_path):
        print(f"[WARN] File not found: {image_path}")
        return None, None
    img = cv2.imread(image_path)
    if img is None:
        print(f"[WARN] cv2.imread returned None for: {image_path}")
        return None, None
    faces = app.get(img)
    if not faces:
        print(f"[WARN] No face detected in: {image_path}")
        return None, None
    # Pick the face with best confidence
    best_face = max(faces, key=lambda x: float(x.det_score or 0.0))
    conf = float(best_face.det_score or 0.0)
    embedding = best_face.normed_embedding
    if embedding is None:
        return None, None
    return embedding.tolist(), conf

def process_employee(db, emp_id: int):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        print(f"[ERROR] Employee {emp_id} not found.")
        return
    if not emp.image_url:
        print(f"[SKIP] Employee {emp_id} has no image.")
        return
    
    # Path is relative: /static/uploads/employees/...
    # Resolve absolute path on disk
    rel_path = emp.image_url.lstrip("/")
    abs_path = os.path.join('/home/smartgate/BioFace/backend', rel_path)
    
    print(f"Processing Employee {emp_id}: {emp.first_name} {emp.last_name} ({abs_path})")
    emb, conf = get_face_embedding(abs_path)
    if emb:
        # Save or update face embedding
        existing = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == emp_id).first()
        if existing:
            existing.embedding_data = emb
            existing.confidence = conf
            existing.model_version = "insightface_buffalo_l"
        else:
            new_emb = FaceEmbedding(
                employee_id=emp_id,
                embedding_data=emb,
                confidence=conf,
                model_version="insightface_buffalo_l"
            )
            db.add(new_emb)
        db.commit()
        print(f"[SUCCESS] Saved embedding for Employee {emp_id} (conf: {conf:.3f})")
    else:
        print(f"[FAILED] Could not generate embedding for Employee {emp_id}")

def process_user(db, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"[ERROR] User {user_id} not found.")
        return
    if not user.image_url:
        print(f"[SKIP] User {user_id} has no image.")
        return
    
    rel_path = user.image_url.lstrip("/")
    abs_path = os.path.join('/home/smartgate/BioFace/backend', rel_path)
    
    print(f"Processing User {user_id}: {user.name} ({abs_path})")
    emb, conf = get_face_embedding(abs_path)
    if emb:
        existing = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user_id).first()
        if existing:
            existing.embedding_data = emb
            existing.confidence = conf
            existing.model_version = "insightface_buffalo_l"
        else:
            new_emb = FaceEmbedding(
                user_id=user_id,
                embedding_data=emb,
                confidence=conf,
                model_version="insightface_buffalo_l"
            )
            db.add(new_emb)
        db.commit()
        print(f"[SUCCESS] Saved embedding for User {user_id} (conf: {conf:.3f})")
    else:
        print(f"[FAILED] Could not generate embedding for User {user_id}")

def process_all():
    db = SessionLocal()
    try:
        # Get employees who have images but no embeddings yet
        employees = db.query(Employee).filter(
            Employee.image_url.isnot(None),
            ~Employee.embeddings.any()
        ).all()
        print(f"Found {len(employees)} employees needing embeddings.")
        for emp in employees:
            try:
                process_employee(db, emp.id)
            except Exception as e:
                print(f"[ERROR] Error processing employee {emp.id}: {e}")

        # Get users who have images but no embeddings yet
        users = db.query(User).filter(
            User.image_url.isnot(None),
            ~User.embeddings.any()
        ).all()
        print(f"Found {len(users)} users needing embeddings.")
        for u in users:
            try:
                process_user(db, u.id)
            except Exception as e:
                print(f"[ERROR] Error processing user {u.id}: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--employee-id", type=int, help="Process specific employee ID")
    parser.add_argument("--user-id", type=int, help="Process specific user ID")
    parser.add_argument("--all", action="store_true", help="Process all missing embeddings")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.employee_id:
            process_employee(db, args.employee_id)
        elif args.user_id:
            process_user(db, args.user_id)
        elif args.all:
            process_all()
        else:
            parser.print_help()
    finally:
        db.close()
