from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from core.config import settings
from api.api import api_router

# ─── Initialize FastAPI ───────────────────────────────────────────
app = FastAPI(title=settings.app_name, version=settings.version)

# ─── CORS Configuration ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ─── API Endpoints ───────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": f"{settings.app_name} v{settings.version} — Online", "timestamp": datetime.utcnow().isoformat()}

app.include_router(api_router, prefix="/api/v1")
