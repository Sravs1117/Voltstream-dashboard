"""
schemas/chat.py
---------------
Pydantic models for the /api/v1/chat endpoint.
Supports both strict RAG mode (JSON) and General Gemini mode (multipart with optional PDF).
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class ChatMessage(BaseModel):
    """A single message in the history."""
    role: str = Field(..., description="Either 'user' or 'bot'")
    text: str = Field(..., description="Message content")


class ChatResponse(BaseModel):
    """Outgoing response returned to the client."""

    answer: str = Field(
        ...,
        description="Answer from either RAG pipeline or Gemini direct chat.",
    )
    sources: List[str] = Field(
        default_factory=list,
        description="Source references (RAG mode only). Empty for general chat.",
    )
    mode: str = Field(
        default="rag",
        description="Which mode was used: 'rag' or 'general'.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "answer": "Solar panels achieve 22% efficiency under standard conditions.",
                "sources": ["solar.pdf (page 3)"],
                "mode": "rag",
            }
        }
    }
