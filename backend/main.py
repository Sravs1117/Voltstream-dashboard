"""
main.py
-------
VoltStream Dashboard — FastAPI Application Entry Point

Startup sequence:
  1. Configure logging
  2. Initialize RAG pipeline (PDF → Embeddings → ChromaDB → Gemini)
  3. Mount all API routers under /api/v1
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from core.config import settings
from api.api import api_router
from services.rag_service import rag_service
from db.database import engine, Base, SessionLocal
from db.crud import seed_db
from services.telemetry_service import telemetry_service

# ─── Logging Configuration ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Application Lifespan ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs startup/shutdown tasks around the application lifecycle."""
    logger.info("🚀 VoltStream API starting up ...")
    
    logger.info("💾 Initializing SQLite Database tables ...")
    Base.metadata.create_all(bind=engine)
    
    logger.info("🌱 Seeding initial data ...")
    db = SessionLocal()
    try:
        seed_db(db)
    except Exception as e:
        logger.error(f"❌ Error during database seeding: {e}")
    finally:
        db.close()
        
    logger.info("⚙️  Initializing RAG pipeline ...")
    rag_service.initialize()
    
    logger.info("📡 Starting real-time telemetry simulation ...")
    telemetry_service.start()
    
    logger.info("✅ All services ready. Server is online.")
    yield
    
    logger.info("🔌 Stopping telemetry simulation ...")
    telemetry_service.stop()
    logger.info("🛑 VoltStream API shutting down.")


# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "VoltStream Energy Dashboard API — Real-time analytics, device management, "
        "billing, and GenAI-powered RAG Q&A chatbot."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["health"], summary="API Health Check")
def root():
    return {
        "service": settings.app_name,
        "version": settings.version,
        "status": "online",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

# ─── API Routes ───────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")
