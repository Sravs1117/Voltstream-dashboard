"""
agents/usage_insights_agents.py
--------------------------------
VoltStream Multi-Agent System — Clean ADK Architecture

Architecture:
  orchestrator_agent
    ├── analyst_agent   (tool: get_usage_data → SQLite)
    └── advisor_agent   (tool: search_energy_knowledge → PDF RAG)

Flow:
  • Usage question   → Orchestrator → Analyst Agent → get_usage_data() → answer
  • Tips question    → Orchestrator → Advisor Agent → search_energy_knowledge() → answer
  • Both             → Orchestrator → Analyst first → Advisor with usage context → combined answer
"""

import logging
from typing import Any, Dict, Callable, Annotated
from google.adk.agents import LlmAgent
from google.adk.sessions import InMemorySessionService
from google.genai import Client
from core.config import settings

from core.prompts import (
    ORCHESTRATOR_AGENT_PROMPT,
    ANALYST_AGENT_PROMPT,
    ADVISOR_AGENT_PROMPT,
)

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
#  DECORATORS & TOOLS
# ══════════════════════════════════════════════════════════════════════════════
# ============================================================================
# TOOL ANNOTATION DECORATOR
# ============================================================================

def tool_annotation(
    *,
    name: str,
    agent: str,
    purpose: str,
    when_to_use: str,
    parameters: Dict[str, str],
    returns: str,
) -> Any:
    """
    Attach passive tool metadata for documentation and debugging.
    Does not modify runtime behavior.
    """
    def decorate(func: Any) -> Any:
        func.tool_annotation = {
            "name": name,
            "agent": agent,
            "purpose": purpose,
            "when_to_use": when_to_use,
            "parameters": parameters,
            "returns": returns,
        }
        return func

    return decorate


# ============================================================================
# ANALYST AGENT TOOL
# ============================================================================

@tool_annotation(
    name="get_usage_data",
    agent="analyst_agent",
    purpose="Retrieve usage information from the VoltStream data source.",
    when_to_use="Called by the Analyst Agent when usage information is required.",
    parameters={
        "user_id": "User identifier.",
        "period": "Time period for the request.",
    },
    returns="Usage information returned by the Analyst Agent.",
)
def get_usage_data(
    user_id: Annotated[str, "User identifier."] = "user_001",
    period: Annotated[str, "Time period for the request."] = "weekly",
) -> dict:
    """
    Retrieve electricity usage data from VoltStream SQLite database.
    """
    from db.crud import get_energy_usage_summary

    return get_energy_usage_summary(period)


# ============================================================================
# ADVISOR AGENT TOOL
# ============================================================================

@tool_annotation(
    name="search_energy_knowledge",
    agent="advisor_agent",
    purpose="Retrieve information from the VoltStream knowledge base.",
    when_to_use="Called by the Advisor Agent when knowledge base information is required.",
    parameters={
        "query": "Input provided to the knowledge base search.",
    },
    returns="Information returned from the knowledge base.",
)
def search_energy_knowledge(
    query: Annotated[
        str,
        "Input provided to the knowledge base search."
    ]
) -> str:
    """
    Search the VoltStream energy-efficiency knowledge base (PDF).
    """
    from agents.rag import get_energy_recommendations

    return get_energy_recommendations(query)
# ══════════════════════════════════════════════════════════════════════════════
#  SUB-AGENTS
# ══════════════════════════════════════════════════════════════════════════════

analyst_agent = LlmAgent(
    name="analyst_agent",
    model="gemini-2.5-flash",
    description=(
        "Handles requests specifically asking to look up the user's personal historical electricity usage data, "
        "consumption numbers, billing history, or personal device data from the SQL database. "
        "DO NOT use this for general knowledge questions or energy-saving advice."
    ),
    instruction=ANALYST_AGENT_PROMPT,
    tools=[get_usage_data],
)

advisor_agent = LlmAgent(
    name="advisor_agent",
    model="gemini-2.5-flash",
    description=(
        "Handles all general knowledge questions, energy-saving tips, efficiency advice, solar power queries, "
        "R-values, cost-effective upgrades, and recommendations using the PDF document knowledge base."
    ),
    instruction=ADVISOR_AGENT_PROMPT,
    tools=[search_energy_knowledge],
)

# ══════════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

orchestrator_agent = LlmAgent(
    name="orchestrator_agent",
    model="gemini-2.5-flash",
    description="Main coordinator that routes user queries to the correct sub-agent.",
    instruction=ORCHESTRATOR_AGENT_PROMPT,
    sub_agents=[analyst_agent, advisor_agent],
)

# ── Session Service ────────────────────────────────────────────────────────────
_session_service = InMemorySessionService()
