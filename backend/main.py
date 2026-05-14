from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from contextlib import asynccontextmanager

from core.config import settings
from api.api import api_router
# from services.rag_service import rag_service

# ─── Initialize FastAPI ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize RAG service on startup
    # rag_service.initialize()
    pass
    yield

app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

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
