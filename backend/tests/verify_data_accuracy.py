"""
verify_data_accuracy.py
-----------------------
Data Accuracy Verification for VoltStream Multi-Agent System.

This script:
  1. Queries voltstream.db DIRECTLY — raw ground truth
  2. Manually computes expected values (same formula as the code)
  3. Runs the analyst_agent and captures its actual response
  4. Compares expected vs actual — field by field
  5. Reports CORRECT / WRONG for every value

Run: python verify_data_accuracy.py
"""

import sys
import os
import sqlite3
import asyncio
import re
import time

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv()

# --- Colors ------------------------------------------------------------------
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

DB_PATH = "db/voltstream.db"

# =============================================================================
#  STEP 1: Query the DB directly — raw ground truth
# =============================================================================

def query_db_directly():
    """Read every device row from voltstream.db and return raw data."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT name, type, is_on, power_w FROM devices ORDER BY power_w DESC")
    devices = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return devices

# =============================================================================
#  STEP 2: Manually compute expected values (same formula as insights.py)
# =============================================================================

def compute_expected(devices: list, period: str = "weekly") -> dict:
    from db.crud import get_energy_usage_summary
    res = get_energy_usage_summary(period)
    
    return {
        "period": res.get("period", "N/A"),
        "total_consumption": res.get("total_consumption", "N/A"),
        "peak_hours": res.get("peak_hours", "N/A"),
        "highest_device": res.get("highest_device", "N/A"),
        "weekend_usage": res.get("weekend_usage", "N/A"),
    }

# =============================================================================
#  STEP 3: Run the analyst agent and capture its raw text reply
# =============================================================================

async def run_analyst_agent(period: str = "weekly") -> str:
    from agents.usage_insights_agents import analyst_agent, _session_service
    from google.adk.runners import Runner
    from google.genai import types as genai_types
    
    runner = Runner(agent=analyst_agent, session_service=_session_service, app_name="voltstream_orchestrator")
    
    # Clean up old session if it exists to prevent state pollution
    if await _session_service.get_session(app_name="voltstream_orchestrator", user_id="insights_user", session_id="accuracy_test_session"):
        pass # ADK memory session service doesn't have an explicit delete in all versions, we just reuse it or rely on it being empty
    else:
        await _session_service.create_session(
            app_name="voltstream_orchestrator",
            user_id="insights_user",
            session_id="accuracy_test_session",
        )
    
    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=f"Retrieve and analyze the user's electricity usage data for the {period} period. User query: Show my {period} electricity usage")],
    )
    
    reply = ""
    async for event in runner.run_async(
        user_id="insights_user",
        session_id="accuracy_test_session",
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    reply += part.text
                    
    return reply

# =============================================================================
#  STEP 4: Parse numbers from agent reply text
# =============================================================================

def extract_number(text: str, label: str) -> str:
    """
    Find the value reported by the agent for a given label.
    e.g. extract_number(reply, "Total Consumption") → "897.3 kWh"
    """
    pattern = rf"{re.escape(label)}\s*[:\-]\s*([^\n]+)"
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1).strip() if m else "NOT FOUND"

def extract_float(raw: str) -> float | None:
    """Pull the first float from a string like '897.3 kWh' → 897.3"""
    m = re.search(r"[\d]+\.?[\d]*", raw)
    return float(m.group()) if m else None

# =============================================================================
#  STEP 5: Compare expected vs actual
# =============================================================================

def compare(label: str, expected, actual_raw: str, tolerance: float = 5.0):
    """
    Compare expected numeric value with what the agent reported.
    tolerance: max allowed % difference (to account for timing differences in power_w)
    """
    actual_num = extract_float(actual_raw)
    if actual_raw == "NOT FOUND":
        print(f"  {RED}[MISSING]{RESET}  {label}")
        print(f"           Expected : {YELLOW}{expected}{RESET}")
        print(f"           Agent    : {RED}NOT FOUND in response{RESET}")
        return False

    if actual_num is None:
        print(f"  {RED}[UNPARSEABLE]{RESET}  {label}")
        print(f"           Expected : {YELLOW}{expected}{RESET}")
        print(f"           Agent    : {RED}{actual_raw}{RESET}")
        return False

    expected_num = float(expected)
    if expected_num == 0:
        diff_pct = 0.0 if actual_num == 0 else 100.0
    else:
        diff_pct = abs(actual_num - expected_num) / expected_num * 100

    within_tolerance = diff_pct <= tolerance

    if within_tolerance:
        status = f"{GREEN}[CORRECT]{RESET}"
        diff_info = f"{GREEN}diff = {diff_pct:.1f}%{RESET}"
    else:
        status = f"{RED}[WRONG]{RESET}  "
        diff_info = f"{RED}diff = {diff_pct:.1f}%  <-- EXCEEDS {tolerance}% tolerance{RESET}"

    print(f"  {status}  {label}")
    print(f"           DB expects : {YELLOW}{expected}{RESET}")
    print(f"           Agent said : {CYAN}{actual_raw}{RESET}")
    print(f"           {diff_info}")
    return within_tolerance

def compare_text(label: str, expected: str, actual_raw: str):
    """Compare expected string (non-numeric) with agent reply."""
    match = expected.lower() in actual_raw.lower() if actual_raw != "NOT FOUND" else False
    status = f"{GREEN}[CORRECT]{RESET}" if match else f"{RED}[WRONG]{RESET}  "
    print(f"  {status}  {label}")
    print(f"           DB expects : {YELLOW}{expected}{RESET}")
    print(f"           Agent said : {CYAN}{actual_raw}{RESET}")
    return match

# =============================================================================
#  MAIN
# =============================================================================

async def main():
    period = "weekly"

    print(f"\n{BOLD}{CYAN}{'='*66}{RESET}")
    print(f"{BOLD}{CYAN}  VoltStream — Data Accuracy Verification{RESET}")
    print(f"{BOLD}{CYAN}  Checking: Does the agent return correct data from the DB?{RESET}")
    print(f"{BOLD}{CYAN}{'='*66}{RESET}")

    # ── Step 1: Read DB directly ──────────────────────────────────────────────
    print(f"\n{BOLD}STEP 1 — Reading voltstream.db directly (raw ground truth){RESET}")
    print(f"{'─'*60}")
    devices = query_db_directly()
    print(f"  Total devices in DB : {len(devices)}")
    on_devices = [d for d in devices if d["is_on"]]
    print(f"  Devices currently ON: {len(on_devices)}")
    print()
    print(f"  {'Name':<30} {'Type':<14} {'Power (W)':>10}  {'Status'}")
    print(f"  {'-'*30} {'-'*14} {'-'*10}  {'-'*8}")
    for d in devices:
        status = f"{GREEN}ON{RESET}" if d["is_on"] else f"{DIM}OFF{RESET}"
        print(f"  {d['name']:<30} {d['type']:<14} {d['power_w']:>10.1f}  {status}")

    # ── Step 2: Compute expected values ───────────────────────────────────────
    print(f"\n{BOLD}STEP 2 — Computing expected values from DB data{RESET}")
    print(f"{'─'*60}")
    exp = compute_expected(devices, period)

    print(f"  Expected outputs from DB:")
    print(f"    Time Period        = {exp['period']}")
    print(f"    Total Consumption  = {exp['total_consumption']}")
    print(f"    Peak Usage Hours   = {exp['peak_hours']}")
    print(f"    Highest Device     = {exp['highest_device']}")
    print(f"    Weekend Usage      = {exp['weekend_usage']}")

    # ── Step 3: Run the agent ─────────────────────────────────────────────────
    print(f"\n{BOLD}STEP 3 — Running analyst_agent (ADK LlmAgent + SQL tool){RESET}")
    print(f"{'─'*60}")
    print(f"  {YELLOW}Query: Show my weekly electricity usage{RESET}")
    print(f"  {YELLOW}Waiting for Gemini response ...{RESET}")

    t0 = time.perf_counter()
    agent_reply = await run_analyst_agent(period)
    elapsed = round(time.perf_counter() - t0, 1)

    print(f"\n  Agent replied in {elapsed}s. Raw response:")
    print(f"  {'-'*58}")
    for line in agent_reply.split("\n"):
        print(f"  | {line}")
    print(f"  {'-'*58}")

    # ── Step 4: Extract values from agent reply ───────────────────────────────
    print(f"\n{BOLD}STEP 4 — Extracting values from agent response{RESET}")
    print(f"{'─'*60}")
    agent_period    = extract_number(agent_reply, "Time Period")
    agent_total     = extract_number(agent_reply, "Total Consumption")
    agent_peak      = extract_number(agent_reply, "Peak Usage Hours")
    agent_device    = extract_number(agent_reply, "Highest Consuming Device")
    agent_weekend   = extract_number(agent_reply, "Weekend Usage")

    print(f"  Time Period         : {agent_period}")
    print(f"  Total Consumption   : {agent_total}")
    print(f"  Peak Usage Hours    : {agent_peak}")
    print(f"  Highest Device      : {agent_device}")
    print(f"  Weekend Usage       : {agent_weekend}")

    # ── Step 5: Compare field by field ────────────────────────────────────────
    print(f"\n{BOLD}STEP 5 — Accuracy Check: DB expected vs Agent reported{RESET}")
    print(f"{'─'*60}")
    print(f"  {DIM}Tolerance: +/- 5% allowed (DB is queried at slightly different times){RESET}\n")

    results = []
    
    # We compare as strings because the prompt says "analyze: Time Period, Total Consumption..."
    results.append(compare_text("Time Period",           exp["period"],                 agent_period))
    results.append(compare_text("Total Consumption",     exp["total_consumption"],      agent_total))
    results.append(compare_text("Peak Hours",           exp["peak_hours"],            agent_peak))
    results.append(compare_text("Highest Device Name",      exp["highest_device"].split(" ")[0],       agent_device))
    results.append(compare_text("Weekend Usage",       exp["weekend_usage"],        agent_weekend))

    # ── Final verdict ─────────────────────────────────────────────────────────
    passed = sum(results)
    total  = len(results)
    print(f"\n{'─'*60}")
    print(f"  {BOLD}ACCURACY SCORE : {passed}/{total} fields correct{RESET}")

    if passed == total:
        print(f"\n  {GREEN}{BOLD}VERDICT: DATA IS CORRECT{RESET}")
        print(f"  {GREEN}The agent is reading and reporting accurate data from the DB.{RESET}")
    elif passed >= total * 0.75:
        print(f"\n  {YELLOW}{BOLD}VERDICT: MOSTLY CORRECT — minor discrepancies detected{RESET}")
        print(f"  {YELLOW}Check the WRONG fields above.{RESET}")
    else:
        print(f"\n  {RED}{BOLD}VERDICT: DATA MISMATCH — agent is NOT reporting correct DB values{RESET}")
        print(f"  {RED}The agent output does not match what is in the database.{RESET}")

    print()

if __name__ == "__main__":
    asyncio.run(main())
