"""
services/gemini_service.py
--------------------------
Direct Gemini chat service using the NEW google-genai SDK.
Replaces the deprecated google.generativeai package.

Supports:
  - Context-aware conversation (history)
  - Full VoltStream platform knowledge
  - General knowledge fallback
"""

import logging
from typing import Optional, List, Dict

import fitz  # PyMuPDF
from google import genai
from google.genai import types

from core.config import settings

logger = logging.getLogger(__name__)

# ─── VoltStream Knowledge Base ────────────────────────────────────────────────

VOLTSTREAM_APP_MANUAL = """
VOLTSTREAM PLATFORM MANUAL:
1. Dashboard Page:
   - Overview of entire system performance.
   - Real-time Solar Output (Watts/kW).
   - Energy Efficiency metrics.
   - Active Device count.
   - Daily/Monthly savings summary.
   - Live energy flow diagram.

2. Analytics Page:
   - Detailed historical charts (Bar, Line).
   - Filter by Day, Week, Month, Year.
   - Peak usage hours identification.
   - Comparative analysis between solar vs grid usage.
   - Export reports as CSV/PDF.

3. Energy Monitoring & Solar Tracking:
   - Monitor real-time voltage and current from inverter.
   - Solar panel efficiency tracking.
   - Battery health and state of charge (if applicable).
   - Carbon footprint reduction tracker.

4. Billing Section:
   - Invoices list and payment status.
   - Predicted bill for the current month.
   - Historical billing trends.
   - Payment gateway integration (Stripe/PayPal).

5. Device Management & Smart Control:
   - List of all IoT devices (Lights, HVAC, EV Charger).
   - Remote On/Off controls.
   - Automated schedules (turn off at night, etc.).
   - Power consumption per device.

6. Alerts & Notifications:
   - Critical alerts for power surges or battery low.
   - Maintenance reminders for solar panels.
   - Configurable notification settings (Email/SMS).

7. User Management:
   - Profile settings (Name, Address, Plan).
   - Multi-user access (Admin vs Family members).
   - Activity logs.

8. Reports:
   - Monthly energy audit.
   - Cost-saving recommendations.
   - System uptime statistics.
"""

SYSTEM_PROMPT = f"""
You are VoltStream Bot, an advanced AI assistant.

PERSONALITY:
- Professional, versatile, and extremely smart.
- You answer EVERY question on ANY topic (current affairs, movies, history, science, coding, life).
- You are also the expert for the VoltStream Energy platform.

KNOWLEDGE BASE (VoltStream):
{VOLTSTREAM_APP_MANUAL}

STRICT RULES:
1. DYNAMIC BREVITY: 
   - For simple questions (greetings, quick facts), answer in 1-2 lines.
   - For complex questions (app explanations, deep dives), answer in maximum 5 lines.
   - NEVER exceed 5 lines total.
2. ANSWER EVERYTHING: Never refuse a question. Answer movies, news, or app info equally well.
3. CONTEXT: Maintain conversation history context (memory).
4. NO FILLER: Skip introductions. Get straight to the point.
"""

class GeminiService:
    def __init__(self):
        self.client = None
        if settings.google_api_key:
            try:
                self.client = genai.Client(api_key=settings.google_api_key)
                logger.info("✅ Gemini Client initialized.")
            except Exception as e:
                logger.error("❌ Failed to initialize Gemini client: %s", e)

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages = [page.get_text() for page in doc]
            doc.close()
            return "\n".join(pages).strip()
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {e}") from e

    def chat(self, message: str, history: Optional[List[Dict[str, str]]] = None, pdf_context: Optional[str] = None) -> str:
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
        if pdf_context:
            current_text = f"--- PDF CONTEXT ---\n{pdf_context[:20000]}\n--- END PDF ---\n\n{message}"

        try:
            # FIX: Updated model string to a valid, active production identifier
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=gemini_history + [types.Content(role='user', parts=[types.Part(text=current_text)])],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.7,
                    max_output_tokens=1024,
                ),
            )
            return response.text.strip()
        except Exception as e:
            logger.exception("❌ Gemini API error: %s", e)
            raise RuntimeError(f"Gemini API error: {e}") from e

gemini_service = GeminiService()