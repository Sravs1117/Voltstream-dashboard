"""
api/qa.py
---------
Endpoint 2: /api/v1/qa  — The "Strict Brain"

Strictly searches indexed ChromaDB documents via the RAG pipeline.
If the answer is not found in indexed docs, returns exactly:
  "I don't have that information."

No general Gemini knowledge. No hallucination. Pure document retrieval.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List

from services.rag_service import rag_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schema (local, only for this endpoint) ───────────────────────────────────

class QARequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question for strict RAG search.")


class QAResponse(BaseModel):
    answer: str = Field(..., description="Grounded answer from indexed documents, or 'I don't have that information.'")
    sources: List[str] = Field(default_factory=list, description="Source references from ChromaDB.")
    mode: str = Field(default="rag", description="Always 'rag' for this endpoint.")


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=QAResponse,
    status_code=status.HTTP_200_OK,
    summary="Strict RAG Q&A — indexed documents only",
    description=(
        "Searches indexed ChromaDB documents (all-MiniLM-L6-v2 embeddings). "
        "If the answer is not found, returns exactly: 'I don't have that information.' "
        "No general AI knowledge is used."
    ),
    tags=["qa"],
)
async def qa_endpoint(payload: QARequest) -> QAResponse:
    """
    Strict RAG endpoint — no hallucination, no general knowledge.
    """
    try:
        logger.info("📥 [QA] Strict RAG query: '%s'", payload.query[:80])
        result = rag_service.ask(payload.query)
        logger.info("📤 [QA] Answer ready. Sources: %s", result.get("sources"))
        return QAResponse(
            answer=result["answer"],
            sources=result.get("sources", []),
            mode="rag",
        )
    except Exception as exc:
        logger.exception("❌ [QA] RAG query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while searching indexed documents.",
        )
