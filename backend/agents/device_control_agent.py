import random
import sqlite3
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from core.config import settings
from core.prompts import VOLTSTREAM_DEVICE_AGENT_PROMPT

APP_NAME = "voltstream"
USER_ID  = "voltstream_user"

DB_PATH = (
    settings.database_url.replace("sqlite:///", "")
    if hasattr(settings, "database_url")
    else "db/voltstream.db"
)

# ─── TOOL 1: list_all_devices ─────────────────────────────────────────────────
def list_all_devices() -> str:
    """
    Returns ALL devices registered in the VoltStream smart-home system.
    Each entry includes the device's unique numeric ID, name, type, and
    current power state (ON/OFF).

    ALWAYS call this first before any toggle or status action, so you can
    identify the correct device ID from the user's request.

    Returns:
        A list of all devices with their ID, name, type, and current state.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, type, is_on, power_w FROM devices ORDER BY name")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()

        if not rows:
            return "No devices found in the system."

        lines = ["All registered devices:\n"]
        for d in rows:
            status = "ON" if d["is_on"] == 1 else "OFF"
            lines.append(
                f"  ID={d['id']} | {d['name']} | Type: {d['type']} | Currently: {status} | {d['power_w']}W"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Database error: {str(e)}"

# ─── TOOL 2: toggle_device_by_id ─────────────────────────────────────────────
def toggle_device_by_id(device_id: str, state: str) -> str:
    """
    Turns a device ON or OFF using its exact numeric or string ID.
    Use the ID from the list_all_devices output.

    Args:
        device_id: The ID of the device (e.g. 'dev_02', '3').
        state:     'on' to power on, 'off' to power off.

    Returns:
        Confirmation that the device was changed, or a notice that it was
        already in the requested state.
    """
    state_clean = state.strip().lower()
    numeric_state = 1 if state_clean == "on" else 0

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, is_on FROM devices WHERE id = ?", (device_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return (
                f"No device with ID {device_id} exists. "
                f"Call list_all_devices to get valid IDs."
            )

        actual_id, actual_name, current_state = row

        # Device is already in the requested state — no write needed
        if current_state == numeric_state:
            conn.close()
            label = "on" if numeric_state == 1 else "off"
            return f"{actual_name} is already turned {label}. No changes were made."

        cursor.execute("UPDATE devices SET is_on = ? WHERE id = ?", (numeric_state, actual_id))
        conn.commit()
        conn.close()

        print(f"[VoltStream AI] {actual_name} (ID={actual_id}) → {state_clean}")
        return f"{actual_name} has been turned {state_clean} successfully."

    except Exception as e:
        return f"Database error: {str(e)}"

# ─── TOOL 3: turn_off_all_devices ────────────────────────────────────────────
def turn_off_all_devices() -> str:
    """
    Turns off every device in the smart grid at once.
    Use when the user says 'turn off everything', 'all devices off',
    'night mode', 'energy saver', etc.

    Returns:
        Confirmation of how many devices were powered off.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE devices SET is_on = 0")
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        print(f"[VoltStream AI] All {affected} device(s) turned off.")
        return f"All {affected} device(s) have been turned off successfully."
    except Exception as e:
        return f"Database error: {str(e)}"

# ─── TOOL 4: get_device_status ───────────────────────────────────────────────
def turn_on_all_devices() -> str:
    """
    Turns on every device in the smart grid at once.
    Use when the user says 'turn on everything', 'all devices on',
    'turn on all devices', etc.

    Returns:
        Confirmation of how many devices were powered on.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_on FROM devices")
        devices = cursor.fetchall()

        if not devices:
            conn.close()
            return "No devices found in the system."

        for device_id, is_on in devices:
            if is_on:
                cursor.execute("UPDATE devices SET is_on = 1 WHERE id = ?", (device_id,))
            else:
                cursor.execute(
                    "UPDATE devices SET is_on = 1, power_w = ? WHERE id = ?",
                    (round(random.uniform(200.0, 2000.0), 1), device_id),
                )

        conn.commit()
        conn.close()
        print(f"[VoltStream AI] All {len(devices)} device(s) turned on.")
        return f"All {len(devices)} device(s) have been turned on successfully."
    except Exception as e:
        return f"Database error: {str(e)}"

def turn_on_all_lights() -> str:
    """
    Turns on every lighting device at once.
    Use when the user says 'turn on all lights', 'lights on',
    'switch on every light', etc.

    Returns:
        Confirmation of how many lighting devices were powered on.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, is_on
            FROM devices
            WHERE LOWER(type) IN ('lighting', 'lights')
               OR LOWER(name) LIKE '%light%'
            """
        )
        lights = cursor.fetchall()

        if not lights:
            conn.close()
            return "No lighting devices were found."

        for device_id, is_on in lights:
            if is_on:
                cursor.execute("UPDATE devices SET is_on = 1 WHERE id = ?", (device_id,))
            else:
                cursor.execute(
                    "UPDATE devices SET is_on = 1, power_w = ? WHERE id = ?",
                    (round(random.uniform(20.0, 80.0), 1), device_id),
                )

        conn.commit()
        conn.close()
        print(f"[VoltStream AI] All {len(lights)} light device(s) turned on.")
        return f"All {len(lights)} light device(s) have been turned on successfully."
    except Exception as e:
        return f"Database error: {str(e)}"

def toggle_first_matching_device(keyword: str, state: str) -> str:
    """
    Fast path for common UI prompts that name one obvious device.
    """
    state_clean = state.strip().lower()
    numeric_state = 1 if state_clean == "on" else 0

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, name, is_on, type
            FROM devices
            WHERE LOWER(name) LIKE ?
            ORDER BY name
            LIMIT 1
            """,
            (f"%{keyword.lower()}%",),
        )
        row = cursor.fetchone()

        if not row:
            conn.close()
            return f"No device matching '{keyword}' was found."

        device_id, name, is_on, dev_type = row
        if is_on == numeric_state:
            conn.close()
            return f"{name} is already turned {state_clean}."

        if numeric_state == 1:
            power_w = round(random.uniform(20.0, 80.0), 1) if "light" in dev_type.lower() or "light" in name.lower() else round(random.uniform(200.0, 2000.0), 1)
        else:
            power_w = 0.0

        cursor.execute(
            "UPDATE devices SET is_on = ?, power_w = ? WHERE id = ?",
            (numeric_state, power_w, device_id),
        )
        conn.commit()
        conn.close()

        print(f"[VoltStream AI] {name} (ID={device_id}) -> {state_clean}")
        return f"{name} has been turned {state_clean} successfully."
    except Exception as e:
        return f"Database error: {str(e)}"

def get_device_status(device_id: str) -> str:
    """
    Checks the current status (ON/OFF) and power consumption of a specific device by its ID.

    Args:
        device_id: The ID of the device (e.g. 'dev_02', '3').

    Returns:
        The current status and power consumption of the device, or an error if not found.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name, type, is_on, power_w FROM devices WHERE id = ?", (device_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return f"No device with ID {device_id} exists."

        name, dev_type, is_on, power_w = row
        status = "ON" if is_on == 1 else "OFF"

        return f"{name} ({dev_type}) is currently {status} and consuming {power_w}W."
    except Exception as e:
        return f"Database error: {str(e)}"

# ─── AGENT DEFINITION ─────────────────────────────────────────────────────────

voltstream_agent = Agent(
    name="VoltStream_AI_Agent",
    model="gemini-2.5-flash",
    instruction=VOLTSTREAM_DEVICE_AGENT_PROMPT,
    tools=[list_all_devices, toggle_device_by_id, turn_off_all_devices, turn_on_all_devices, turn_on_all_lights, get_device_status],
)

# ─── SESSION SERVICE & RUNNER ─────────────────────────────────────────────────
_session_service = InMemorySessionService()

_runner = Runner(
    agent=voltstream_agent,
    app_name=APP_NAME,
    session_service=_session_service,
)

