import os
import subprocess
from typing import Optional

def trigger_embedding_generation_bg(employee_id: Optional[int] = None, user_id: Optional[int] = None):
    """
    Triggers the face embedding generation script asynchronously using a subprocess.
    Uses the BioFace backend's python venv to access preconfigured insightface.
    """
    try:
        cmd = ["/home/smartgate/BioFace/backend/.venv/bin/python", "/home/smartgate/BioFace/backend/scripts/generate_embedding.py"]
        if employee_id:
            cmd.extend(["--employee-id", str(employee_id)])
        elif user_id:
            cmd.extend(["--user-id", str(user_id)])
        else:
            return

        # Prepare environment variables including LD_LIBRARY_PATH for CUDA/cuDNN GPU acceleration
        env = os.environ.copy()

        # Locate site-packages of the virtual environment to find NVIDIA library paths
        venv_path = "/home/smartgate/BioFace/backend/.venv"
        site_packages = os.path.join(venv_path, "lib", "python3.12", "site-packages")
        nvidia_dir = os.path.join(site_packages, "nvidia")

        nvidia_libs = []
        if os.path.exists(nvidia_dir):
            for folder in os.listdir(nvidia_dir):
                lib_path = os.path.join(nvidia_dir, folder, "lib")
                if os.path.exists(lib_path):
                    nvidia_libs.append(lib_path)

        if nvidia_libs:
            additional = ":".join(nvidia_libs)
            current_ld = env.get("LD_LIBRARY_PATH", "")
            if current_ld:
                env["LD_LIBRARY_PATH"] = additional + ":" + current_ld
            else:
                env["LD_LIBRARY_PATH"] = additional

        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
    except Exception as e:
        print(f"[EMBEDDING SUBPROCESS] Failed to trigger: {e}")
