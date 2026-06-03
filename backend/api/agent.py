import random
import sqlite3
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from schemas import AICommandRequest
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from core.config import settings
from agents.device_control_agent import _runner, _session_service, turn_off_all_devices, turn_on_all_devices, turn_on_all_lights, toggle_first_matching_device, APP_NAME, USER_ID

router = APIRouter()

# ─── Constants ────────────────────────────────────────────────────────────────
APP_NAME = "voltstream"
USER_ID  = "voltstream_user"

DB_PATH = (
    settings.database_url.replace("sqlite:///", "")
    if hasattr(settings, "database_url")
    else "db/voltstream.db"
)

# ─── ENDPOINT ─────────────────────────────────────────────────────────────────

@router.post("")
async def handle_ai_agent_command(payload: AICommandRequest):
    """
    Receives a natural language command, runs the ADK 2.0 agent loop,
    and returns the reply as JSON.
    """
    try:
        normalized_prompt = payload.prompt.strip().lower()
        if "all" in normalized_prompt and "off" in normalized_prompt:
            return JSONResponse(content={"reply": turn_off_all_devices()})

        if "all" in normalized_prompt and "on" in normalized_prompt and "light" not in normalized_prompt:
            return JSONResponse(content={"reply": turn_on_all_devices()})

        if (
            "light" in normalized_prompt
            and "all" in normalized_prompt
            and "off" not in normalized_prompt
            and (
                " on " in f" {normalized_prompt} "
                or "turn" in normalized_prompt
                or "switch" in normalized_prompt
            )
        ):
            return JSONResponse(content={"reply": turn_on_all_lights()})

        if "bedroom" in normalized_prompt and "light" in normalized_prompt:
            if "off" in normalized_prompt:
                return JSONResponse(content={"reply": toggle_first_matching_device("bedroom light", "off")})
            if "on" in normalized_prompt or "switch" in normalized_prompt or "turn" in normalized_prompt:
                return JSONResponse(content={"reply": toggle_first_matching_device("bedroom light", "on")})

        existing = await _session_service.get_session(
            app_name=APP_NAME,
            user_id=USER_ID,
            session_id=payload.session_id,
        )
        if existing is None:
            await _session_service.create_session(
                app_name=APP_NAME,
                user_id=USER_ID,
                session_id=payload.session_id,
            )

        new_message = genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=payload.prompt)],
        )

        full_response = ""
        async for event in _runner.run_async(
            user_id=USER_ID,
            session_id=payload.session_id,
            new_message=new_message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        full_response += part.text

        return JSONResponse(content={"reply": full_response.strip() or "Done."})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"reply": f"Agent error: {str(e)}"},
        )
