import logging
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(name)s - %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
    rag_service.initialize()
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
