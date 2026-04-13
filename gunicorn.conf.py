# gunicorn.conf.py — BioFace Production (uvloop)
bind = "0.0.0.0:8000"
backlog = 4096
workers = 17
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 2000
timeout = 120
keepalive = 30
graceful_timeout = 30
max_requests = 2000
max_requests_jitter = 200
preload_app = True
accesslog = "/home/admin/BioFace/logs/access.log"
errorlog = "/home/admin/BioFace/logs/error.log"
loglevel = "warning"
capture_output = True
proc_name = "bioface-prod"

# uvloop: har bir worker uchun tezroq async loop
def post_fork(server, worker):
    try:
        import uvloop
        uvloop.install()
    except ImportError:
        pass
