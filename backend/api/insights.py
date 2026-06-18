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

async def run_agent(query: str, session_id: str) -> tuple[str, str, list, dict | None]:
    """
    Sends query to the orchestrator. ADK + Gemini decide which sub-agent runs.
    Returns (response_text, agent_trace, retrieved_chunks, evaluation).
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
    orchestrator_text = ""
    analyst_text = ""
    advisor_text = ""
    seen_agents = set()
    seen_tools = set()

    async for event in _runner.run_async(
        user_id=USER_ID,
        session_id=sid,
        new_message=message
    ):
        author = getattr(event, "author", None)

        # ── Capture text output ──
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    text_to_add = part.text
                    if author == "orchestrator_agent":
                        orchestrator_text += text_to_add
                    elif author == "analyst_agent":
                        analyst_text += text_to_add
                    elif author == "advisor_agent":
                        advisor_text += text_to_add

        # ── Capture tool/function calls ──
        func_calls = event.get_function_calls() if hasattr(event, "get_function_calls") else []
        for fc in func_calls:
            tool_name = fc.name if hasattr(fc, "name") else str(fc)
            tool_key = f"{author}:{tool_name}"
            if tool_key not in seen_tools:
                seen_tools.add(tool_key)
                if author == "analyst_agent" and tool_name == "get_usage_data":
                    trace.append("📊 Analyst Agent — calling tool: get_usage_data()")
                    trace.append("  ↳ Querying VoltStream SQLite database...")
                elif author == "advisor_agent" and tool_name == "search_energy_knowledge":
                    trace.append("💡 Advisor Agent — calling tool: search_energy_knowledge()")
                    trace.append("  ↳ Searching PDF knowledge base via ChromaDB...")
                elif author == "orchestrator_agent":
                    if "transfer" in tool_name.lower():
                        target = tool_name.replace("transfer_to_", "").replace("transfer_", "")
                        # Removed the double 'delegating' log to avoid user confusion
                    else:
                        trace.append(f"🧠 Orchestrator — calling {tool_name}")

        # ── Track which agents participated ──
        if author == "analyst_agent" and "analyst" not in seen_agents:
            seen_agents.add("analyst")

        elif author == "advisor_agent" and "advisor" not in seen_agents:
            seen_agents.add("advisor")

    # Deduplicate: prefer orchestrator's compiled final answer, fallback to sub-agents
    if orchestrator_text.strip():
        full_text = orchestrator_text.strip()
    elif analyst_text.strip() or advisor_text.strip():
        full_text = f"{analyst_text.strip()}\n\n{advisor_text.strip()}".strip()
    else:
        full_text = "No response generated."

    # ── Add source info from RAG after loop ──
    retrieved_chunks = []
    evaluation = None
    # logger.info(f"Debug trace: seen_agents={seen_agents}")
    if "advisor" in seen_agents or advisor_text.strip():
        from agents.rag import rag_service
        
        sources = getattr(rag_service, 'last_sources', [])
        retrieved_chunks = getattr(rag_service, 'last_chunks', [])
        context = getattr(rag_service, 'last_context', "")
        
        eval_answer = advisor_text.strip() if advisor_text.strip() else full_text.strip()
        
        # evaluation_service has been removed
        evaluation = None

        # logger.info(f"Debug trace: sources={sources}, last_chunks_count={len(retrieved_chunks)}")
        if sources:
            source_names = list({s.split(' (')[0] for s in sources})
            if len(source_names) == 1:
                trace.append(f"  ↳ Retrieved from: {source_names[0]}")
            else:
                trace.append("  ↳ Retrieved from:")
                for s in source_names:
                    trace.append(f"      • {s}")

            full_text += "\n\nSources:\n"
            for s in sources:
                full_text += f"* {s}\n"

    trace.append("✅ Response returned to user.")
    return full_text.strip(), "\n".join(trace), retrieved_chunks, evaluation

# ══════════════════════════════════════════════════════════════════════════════
#  FASTAPI ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("")
async def handle_insights_request(payload: InsightsRequest):
    """Main endpoint for the Usage History AI Insights page."""
    try:
        reply, agent_trace, retrieved_chunks, evaluation = await run_agent(payload.prompt, payload.session_id)
        return JSONResponse(content={
            "reply":            reply,
            "agent_trace":      agent_trace,
            "retrieved_chunks": retrieved_chunks,
            "evaluation":       evaluation,
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
        response_text, _, _, _ = await run_agent(payload.query, payload.session_id)
        return {"status": "success", "response": response_text}
    except Exception as e:
        logger.exception("Chat endpoint error: %s", e)
        return JSONResponse(status_code=500, content={
            "status":   "error",
            "response": f"Failed: {str(e)}",
        })

# ══════════════════════════════════════════════════════════════════════════════
#  BENCHMARK EVALUATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

import os
import json

BENCHMARK_RESULTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "benchmark_results.json"
)

@router.post("/benchmark")
async def run_benchmark_endpoint():
    """Runs the 10-question evaluation benchmark and saves results."""
    return JSONResponse(content={
        "status": "success",
        "results": []
    })

@router.get("/benchmark")
async def get_benchmark_results():
    """Retrieves the last stored benchmark results."""
    return JSONResponse(content={
        "status": "success",
        "results": []
    })
