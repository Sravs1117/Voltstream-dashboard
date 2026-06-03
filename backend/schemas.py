"""
schemas.py
----------
Centralized Pydantic schemas for the VoltStream API.
These schemas are used for request validation and response serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS SCHEMAS (Used in api/analytics.py)
# ══════════════════════════════════════════════════════════════════════════════

class EnergyDataPoint(BaseModel):
    label: str
    consumption_kwh: float
    generation_kwh: float

class AnalyticsResponse(BaseModel):
    period: str
    data: List[EnergyDataPoint]


# ══════════════════════════════════════════════════════════════════════════════
#  BILLING SCHEMAS (Used in api/billing.py)
# ══════════════════════════════════════════════════════════════════════════════

class BillingSummary(BaseModel):
    current_balance: float
    projected_bill: float
    budget_limit: float


# ══════════════════════════════════════════════════════════════════════════════
#  CHAT & AI SCHEMAS (Used in api/chat.py, api/qa.py, and api/insights.py)
# ══════════════════════════════════════════════════════════════════════════════


class InsightsRequest(BaseModel):
    prompt:     str
    period:     str = "weekly"
    session_id: str = "insights_session"

class ChatRequest(BaseModel):
    query:      str
    user_id:    str = "user_001"
    session_id: str = "session_001"

class QARequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question for strict RAG search.")

class QAResponse(BaseModel):
    answer: str = Field(..., description="Grounded answer from indexed documents, or 'I don't have that information.'")
    sources: List[str] = Field(default_factory=list, description="Source references from ChromaDB.")
    mode: str = Field(default="rag", description="Always 'rag' for this endpoint.")

class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str = Field(..., description="Either 'user' or 'bot'")
    text: str = Field(..., description="Message content")

class ChatResponse(BaseModel):
    """Outgoing response returned to the client from any AI endpoint."""
    answer: str = Field(
        ...,
        description="Answer from either RAG pipeline, Multi-Agent, or Gemini direct chat.",
    )
    sources: List[str] = Field(
        default_factory=list,
        description="Source references (RAG mode only). Empty for general chat.",
    )
    mode: str = Field(
        default="rag",
        description="Which mode was used: 'rag', 'insights', or 'general'.",
    )
    trace: Optional[str] = Field(
        default=None,
        description="Multi-agent execution trace log (if applicable).",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "answer": "Solar panels achieve 22% efficiency under standard conditions.",
                "sources": ["solar.pdf (page 3)"],
                "mode": "rag",
                "trace": "User\n↓\nOrchestrator Agent\n...",
            }
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD SCHEMAS (Used in api/dashboard.py)
# ══════════════════════════════════════════════════════════════════════════════

class LivePowerStatus(BaseModel):
    """Represents the real-time power snapshot of the home."""
    grid_draw_kw: float
    solar_gen_kw: float
    net_usage_kw: float


# ══════════════════════════════════════════════════════════════════════════════
#  DEVICE CONTROL SCHEMAS (Used in api/device.py)
# ══════════════════════════════════════════════════════════════════════════════

class AICommandRequest(BaseModel):
    prompt: str
    session_id: str = "voltstream_ui_session"

class DeviceResponse(BaseModel):
    """Represents a Smart Device (AC, TV, Fridge) returned to the client."""
    id: str
    name: str
    type: str
    is_on: bool
    power_w: float

class DeviceUpdate(BaseModel):
    """Payload for updating a device's status (e.g. toggling it on/off)."""
    is_on: bool

class DeviceCreate(BaseModel):
    """Payload for registering a new device in the home network."""
    name: str
    type: str
