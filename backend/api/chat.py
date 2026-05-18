"""
api/chat.py
-----------
/api/v1/chat  — The "General Brain" (Gemini always)

  POST /api/v1/chat/  (multipart/form-data)

  Fields:
    message : str   (required)
    pdf     : file  (optional)

  Logic:
    PDF attached → Gemini answers from PDF; if not found, falls back to general knowledge.
    No PDF       → Gemini answers directly from general knowledge.

  NEVER returns "I don't have that information."
  That response is strictly reserved for /api/v1/qa.
"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from schemas.chat import ChatResponse
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)
router = APIRouter()

_MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB


import json
from schemas.chat import ChatResponse, ChatMessage

@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="General AI chat — always powered by Gemini",
    description=(
        "Answers any question using the Gemini API. Supports conversation history for context memory."
    ),
    tags=["chat"],
)
async def chat_endpoint(
    message: str = Form(..., min_length=1, max_length=2000),
    history: Optional[str] = Form(None, description="JSON string of ChatMessage list"),
    pdf: Optional[UploadFile] = File(None),
) -> ChatResponse:
    """
    Always uses Gemini. PDF is optional context — never required.
    """
    logger.info("📥 [Chat] message='%s' | pdf=%s", message[:80], pdf.filename if pdf else None)

    pdf_context: Optional[str] = None
    sources: list[str] = []

    # ── Extract PDF text if provided ──────────────────────────────────────────
    if pdf is not None:
        if not pdf.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only PDF files are supported.",
            )
        pdf_bytes = await pdf.read()
        if len(pdf_bytes) > _MAX_PDF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="PDF file exceeds the 10 MB limit.",
            )
        try:
            pdf_context = gemini_service.extract_text_from_pdf(pdf_bytes)
            if not pdf_context:
                raise ValueError("PDF appears to be empty or image-only.")
            sources = [pdf.filename]
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # ── Parse history if provided ─────────────────────────────────────────────
    parsed_history: List[Dict[str, str]] = []
    if history:
        try:
            data = json.loads(history)
            if isinstance(data, list):
                # Only keep the last 10 messages to avoid token bloat
                parsed_history = data[-10:]
        except Exception:
            logger.warning("⚠️ Failed to parse history JSON")

    # ── Always call Gemini — with or without PDF context ─────────────────────
    try:
        answer = gemini_service.chat(message=message, history=parsed_history, pdf_context=pdf_context)
        logger.info("📤 [Chat] Gemini answer generated. mode=%s", "pdf" if pdf_context else "general")
        return ChatResponse(
            answer=answer,
            sources=sources,
            mode="general",
        )
    except RuntimeError as e:
        logger.exception("❌ [Chat] Gemini error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
