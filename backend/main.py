import os
import warnings

# Globally ignore all warnings (DeprecationWarning, UserWarning, etc.)
warnings.simplefilter("ignore")

# Suppress noisy library progress bars and warnings
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"

if not os.environ.get("GOOGLE_CLOUD_PROJECT"):
    os.environ["GOOGLE_CLOUD_PROJECT"] = "project-8f12ea6a-1eb5-4330-a3b"
if not os.environ.get("GOOGLE_CLOUD_LOCATION"):
    os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"

import logging

# Configure clean, beautiful formatting: [INFO] 12:34:56 | rag - Loaded PDF: efficiency.pdf
class CleanFormatter(logging.Formatter):
    def format(self, record):
        log_time = self.formatTime(record, "%H:%M:%S")
        level_str = f"[{record.levelname}]"
        logger_name = record.name.split(".")[-1]
        return f"{level_str:<7} {log_time} | {logger_name:<12} | {record.getMessage()}"

handler = logging.StreamHandler()
handler.setFormatter(CleanFormatter())

# Clear default handlers to prevent duplicate output
root_logger = logging.getLogger()
for h in root_logger.handlers[:]:
    root_logger.removeHandler(h)

logging.basicConfig(level=logging.INFO, handlers=[handler])

# Suppress verbose HTTP request logs, HuggingFace Hub warnings, and SDK internals
for noisy_logger in [
    "httpx", "chromadb", "urllib3", "google", 
    "google_adk", "sentence_transformers", "asyncio", "uvicorn.access"
]:
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)

for silent_logger in ["huggingface_hub", "langchain"]:
    logging.getLogger(silent_logger).setLevel(logging.ERROR)

logger = logging.getLogger(__name__)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from core.config import settings
from core.database import engine, Base, SessionLocal
from services.telemetry import telemetry_service
from agents.rag import rag_service

# Import Feature Routers
from api.dashboard import router as dashboard_router
from api.analytics import router as analytics_router
from api.devices import router as devices_router
from api.billing import router as billing_router
from api.chat import router as chat_router
from api.qa import router as qa_router
from api.agent import router as agent_router
from api.insights import router as insights_router

# Import all models to register with SQLAlchemy Base before create_all
from db.models import Device
from db.models import PowerReading

# Shared CRUD for seeding
from db.crud import seed_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_db(db)
        finally:
            db.close()
        logger.info("💾 Database connection initialized successfully (SQLite).")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    telemetry_service.start()
    yield
    telemetry_service.stop()
    logger.info("Shutting down.")

app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/", tags=["health"])
def root():
    return {"service": settings.app_name, "status": "online", "timestamp": datetime.utcnow().isoformat() + "Z"}

# Include feature routers
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(devices_router, prefix="/api/v1/devices", tags=["devices"])
app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(qa_router, prefix="/api/v1/qa", tags=["qa"])
app.include_router(agent_router, prefix="/api/v1/agent", tags=["agent"])
app.include_router(insights_router, prefix="/api/v1/insights", tags=["insights"])
