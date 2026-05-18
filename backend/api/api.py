from fastapi import APIRouter
from api import dashboard, analytics, devices, billing, chat, qa

api_router = APIRouter()

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(qa.router, prefix="/qa", tags=["qa"])
