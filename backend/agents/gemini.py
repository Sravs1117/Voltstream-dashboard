"""
services/gemini_service.py
--------------------------
Direct Gemini chat service using the NEW google-genai SDK.

Supports:
  - Context-aware conversation (history)
  - Full VoltStream platform knowledge
  - General knowledge fallback
"""

import logging
from typing import Optional, List, Dict

from google import genai
from google.genai import types

from core.config import settings
from core.prompts import GEMINI_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self.client = None
        try:
            self.client = genai.Client(
                vertexai=True, 
                project=settings.gcp_project, 
                location=settings.gcp_location
            )
            logger.info("✅ Gemini Client initialized with Vertex AI.")
        except Exception as e:
            logger.error("❌ Failed to initialize Gemini client: %s", e)

    def chat(self, message: str, history: Optional[List[Dict[str, str]]] = None, page_context: Optional[str] = None) -> str:
        """
        Sends message to Gemini with system instructions and chat history.
        history format: [{"role": "user", "text": "..."}, {"role": "bot", "text": "..."}]
        """
        if not self.client:
            raise RuntimeError("Gemini API key is not configured.")

        # Format history for Gemini SDK: User -> 'user', Bot -> 'model'
        gemini_history = []
        if history:
            for item in history:
                role = 'user' if item['role'] == 'user' else 'model'
                gemini_history.append(types.Content(role=role, parts=[types.Part(text=item['text'])]))

        # Add the current message
        current_text = message
        if page_context:
            current_text = f"--- ACTIVE PAGE CONTEXT ---\n{page_context}\n--- END PAGE CONTEXT ---\n\n{current_text}"

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=gemini_history + [types.Content(role='user', parts=[types.Part(text=current_text)])],
                config=types.GenerateContentConfig(
                    system_instruction=GEMINI_SYSTEM_PROMPT,
                    temperature=0.7,
                    max_output_tokens=1024,
                ),
            )
            return response.text.strip()
        except Exception as e:
            logger.exception("❌ Gemini API error: %s", e)
            raise RuntimeError(f"Gemini API error: {e}") from e

gemini_service = GeminiService()