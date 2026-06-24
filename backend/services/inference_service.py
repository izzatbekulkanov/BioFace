import os
import sys
import cv2
import numpy as np
import onnxruntime
from typing import Any, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from insightface.app import FaceAnalysis

app = FastAPI(title="BioFace AI Inference Service")

# Initialize InsightFace buffalo_l model
print("[INSIGHTFACE] Loading model buffalo_l in inference service...")
face_app = None
available = onnxruntime.get_available_providers()

if "CUDAExecutionProvider" in available:
    try:
        print("[INSIGHTFACE] GPU detected. Trying CUDAExecutionProvider...")
        face_app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider"])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        print("[INSIGHTFACE] Successfully loaded buffalo_l using GPU (CUDA).")
    except Exception as e:
        print(f"[INSIGHTFACE] Failed to initialize GPU provider: {e}. Falling back to CPU...")
        face_app = None

if face_app is None:
    print("[INSIGHTFACE] Using CPUExecutionProvider...")
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    print("[INSIGHTFACE] Successfully loaded buffalo_l using CPU.")


class EmbeddingRequest(BaseModel):
    image_path: str


@app.get("/health")
def health():
    return {
        "status": "running",
        "gpu_available": "CUDAExecutionProvider" in available,
        "providers": available
    }


@app.post("/generate-embedding")
def generate_embedding(req: EmbeddingRequest):
    image_path = req.image_path
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"File not found: {image_path}")
    
    img = cv2.imread(image_path)
    if img is None:
        raise HTTPException(status_code=400, detail=f"cv2.imread failed for: {image_path}")
        
    faces = face_app.get(img)
    if not faces:
        return {"ok": False, "error": "No face detected"}
        
    # Pick the face with best confidence
    best_face = max(faces, key=lambda x: float(x.det_score or 0.0))
    conf = float(best_face.det_score or 0.0)
    embedding = best_face.normed_embedding
    if embedding is None:
        return {"ok": False, "error": "Could not generate embedding"}
        
    return {
        "ok": True,
        "embedding": embedding.tolist(),
        "confidence": conf
    }


if __name__ == "__main__":
    import uvicorn
    # Listen on localhost port 7690
    uvicorn.run(app, host="127.0.0.1", port=7690)
