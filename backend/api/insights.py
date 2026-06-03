"""
api/insights.py
---------------
VoltStream Multi-Agent System — Usage History AI Insights

Flow:
  User query → Orchestrator Agent → decides intent →
    • analyst_agent   → get_usage_data()           → usage answer
    • advisor_agent   → search_energy_knowledge()  → tips answer
    • both            → analyst first → advisor with context → combined answer
  → Back to Orchestrator → Final response to user
"""

import logging
import trace
import uuid
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from google.adk.runners import Runner
from google.genai import types as genai_types

from agents.usage_insights_agents import orchestrator_agent, _session_service
from schemas import InsightsRequest, ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()

APP_NAME = "voltstream_orchestrator"
USER_ID  = "insights_user"

# ══════════════════════════════════════════════════════════════════════════════
#  ADK RUNNER
# ══════════════════════════════════════════════════════════════════════════════

_runner = Runner(
    agent=orchestrator_agent,
    app_name=APP_NAME,
    session_service=_session_service,
)

async def run_agent(query: str, session_id: str) -> tuple[str, str]:
    """
    Sends query to the orchestrator. ADK + Gemini decide which sub-agent runs.
    Returns (response_text, agent_trace).
    """
    sid = f"{session_id}_{uuid.uuid4().hex[:8]}"

    try:
        existing = await _session_service.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=sid)
        if not existing:
            await _session_service.create_session(
                app_name=APP_NAME,
                user_id=USER_ID,
                session_id=sid,
                state={"usage_analysis": "No usage data available. Give general energy-saving tips."},
            )
    except Exception:
        pass

    message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=query)],
    )

    trace = ["🧠 Orchestrator Agent — analyzing intent..."]
    full_text = ""
    seen_agents = set()
    last_author = None

    async for event in _runner.run_async(
        user_id=USER_ID,
        session_id=sid,
        new_message=message
    ):
        author = getattr(event, "author", None)

        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    text_to_add = part.text
                    if last_author and author != last_author and full_text and not full_text.endswith("\n"):
                        full_text += "\n\n"
                    full_text += text_to_add
                    last_author = author

        if author == "analyst_agent" and "analyst" not in seen_agents:
            trace.append("📊 Analyst Agent — querying VoltStream database...")
            seen_agents.add("analyst")

        elif author == "advisor_agent" and "advisor" not in seen_agents:
            trace.append("💡 Advisor Agent — searching energy knowledge base...")
            seen_agents.add("advisor")

    trace.append("✅ Response returned to user.")
    return full_text.strip(), "\n".join(trace)

# ══════════════════════════════════════════════════════════════════════════════
#  FASTAPI ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("")
async def handle_insights_request(payload: InsightsRequest):
    """Main endpoint for the Usage History AI Insights page."""
    try:
        reply, agent_trace = await run_agent(payload.prompt, payload.session_id)
        return JSONResponse(content={
            "reply":       reply,
            "agent_trace": agent_trace,
        })
    except Exception as e:
        logger.exception("Insights endpoint error: %s", e)
        return JSONResponse(status_code=500, content={
            "reply":       f"Agent error: {e}",
            "agent_trace": "❌ Error during agent execution.",
        })

@router.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    """Standardized chat endpoint."""
    try:
        response_text, _ = await run_agent(payload.query, payload.session_id)
        return {"status": "success", "response": response_text}
    except Exception as e:
        logger.exception("Chat endpoint error: %s", e)
        return JSONResponse(status_code=500, content={
            "status":   "error",
            "response": f"Failed: {str(e)}",
        })
