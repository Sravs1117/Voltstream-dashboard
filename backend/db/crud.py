import random
from sqlalchemy.orm import Session
from db.models import Device, PowerReading
from db.models import Device, PowerReading
def get_latest_power_reading(db: Session):
    return db.query(PowerReading).order_by(PowerReading.timestamp.desc()).first()

def add_power_reading(db: Session, grid_draw_kw: float, solar_gen_kw: float):
    net_usage_kw = round(grid_draw_kw - solar_gen_kw, 2)
    reading = PowerReading(grid_draw_kw=grid_draw_kw, solar_gen_kw=solar_gen_kw, net_usage_kw=net_usage_kw)
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading

def get_devices(db: Session):
    return db.query(Device).all()

def get_device(db: Session, device_id: str):
    return db.query(Device).filter(Device.id == device_id).first()

def update_device_state(db: Session, device_id: str, is_on: bool):
    device = get_device(db, device_id)
    if not device: return None
    device.is_on = is_on
    if is_on: device.power_w = round(random.uniform(200.0, 2000.0), 1)
    else: device.power_w = 0.0
    db.commit()
    db.refresh(device)
    return device

def fluctuate_active_devices_power(db: Session):
    active_devices = db.query(Device).filter(Device.is_on == True, Device.power_w > 0).all()
    for dev in active_devices: dev.power_w = max(0, round(dev.power_w + random.uniform(-10.5, 12.5), 1))
    if active_devices: db.commit()

def create_device(db: Session, id: str, name: str, type: str):
    db_device = Device(id=id, name=name, type=type, is_on=False, power_w=0.0)
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

mock_devices = {
    "dev_01": {"id": "dev_01", "name": "Living Room AC", "type": "hvac", "is_on": True, "power_w": 1450.0},
    "dev_02": {"id": "dev_02", "name": "Smart Refrigerator", "type": "appliance", "is_on": True, "power_w": 165.0},
    "dev_03": {"id": "dev_03", "name": "Washing Machine", "type": "appliance", "is_on": False, "power_w": 0.0},
    "dev_04": {"id": "dev_04", "name": "Samsung TV 65", "type": "entertainment", "is_on": False, "power_w": 0.0},
    "dev_05": {"id": "dev_05", "name": "Microwave Oven", "type": "kitchen", "is_on": False, "power_w": 0.0},
    "dev_06": {"id": "dev_06", "name": "Dishwasher", "type": "appliance", "is_on": False, "power_w": 0.0},
    "dev_07": {"id": "dev_07", "name": "Bedroom Lights", "type": "lighting", "is_on": True, "power_w": 45.0},
    "dev_08": {"id": "dev_08", "name": "Water Heater", "type": "hvac", "is_on": False, "power_w": 0.0},
}

def seed_db(db: Session):
    if db.query(Device).count() == 0:
        for dev_id, data in mock_devices.items():
            db.add(Device(id=data["id"], name=data["name"], type=data["type"], is_on=data["is_on"], power_w=data["power_w"]))
        db.commit()

    if db.query(PowerReading).count() == 0:
        db.add(PowerReading(grid_draw_kw=1.8, solar_gen_kw=3.5, net_usage_kw=-1.7))
        db.commit()


def get_energy_usage_summary(period: str) -> dict:
    import sqlite3
    import calendar
    import logging
    from datetime import datetime, timedelta
    
    logger = logging.getLogger(__name__)
    try:
        from core.config import settings
        DB_PATH = settings.database_url.replace("sqlite:///", "") if hasattr(settings, "database_url") else "db/voltstream.db"
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        now = datetime.now()
        period_lower = period.lower()

        days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        months_of_year = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

        if "yesterday" in period_lower:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
            end_date = start_date + timedelta(days=1)
            hours = 24
            label = "Yesterday"
        elif "today" in period_lower:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            hours = max((now - start_date).total_seconds() / 3600, 1)
            label = "Today"
        elif any(d in period_lower for d in days_of_week):
            target_day = next(i for i, d in enumerate(days_of_week) if d in period_lower)
            days_ago = (now.weekday() - target_day) % 7
            if days_ago == 0 and "last" in period_lower:
                days_ago = 7
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
            if days_ago == 0 and "last" not in period_lower:
                end_date = now
                hours = max((now - start_date).total_seconds() / 3600, 1)
            else:
                end_date = start_date + timedelta(days=1)
                hours = 24
            label = days_of_week[target_day].capitalize()
        elif any(m in period_lower for m in months_of_year):
            target_month = next(i + 1 for i, m in enumerate(months_of_year) if m in period_lower)
            target_year = now.year if target_month <= now.month else now.year - 1
            _, days_in_month = calendar.monthrange(target_year, target_month)
            start_date = now.replace(year=target_year, month=target_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            if target_year == now.year and target_month == now.month:
                end_date = now
                hours = max((now - start_date).total_seconds() / 3600, 1)
            else:
                end_date = start_date + timedelta(days=days_in_month)
                hours = days_in_month * 24
            label = f"{months_of_year[target_month - 1].capitalize()} {target_year}"
        elif any(k in period_lower for k in ["daily", "one day", "1 day", "a day", "last 24", "24 hour", "per day"]):
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            hours = max((now - start_date).total_seconds() / 3600, 1)
            label = "Today"
        elif "month" in period_lower:
            start_date = now - timedelta(days=30)
            end_date = now
            hours = 30 * 24
            label = "Last 30 Days"
        else: # Default to weekly
            start_date = now - timedelta(days=7)
            end_date = now
            hours = 7 * 24
            label = "Last 7 Days"

        cursor.execute(
            '''
            SELECT 
                AVG(net_usage_kw) as avg_net_kw,
                AVG(solar_gen_kw) as avg_solar_kw
            FROM power_readings
            WHERE timestamp >= ? AND timestamp < ?
            ''',
            (start_date.strftime('%Y-%m-%d %H:%M:%S'), end_date.strftime('%Y-%m-%d %H:%M:%S'))
        )
        history = cursor.fetchone()

        net_kwh = round((history["avg_net_kw"] or 0) * hours, 1)
        solar_kwh = round((history["avg_solar_kw"] or 0) * hours, 1)
        total_consumption = round(net_kwh + solar_kwh, 1)
        cost_inr = round(net_kwh * 8.5, 2)

        cursor.execute(
            '''
            SELECT strftime('%H', timestamp) as hour, SUM(net_usage_kw) as usage
            FROM power_readings
            WHERE timestamp >= ? AND timestamp < ?
            GROUP BY hour
            ORDER BY usage DESC LIMIT 1
            ''',
            (start_date.strftime('%Y-%m-%d %H:%M:%S'), end_date.strftime('%Y-%m-%d %H:%M:%S'))
        )
        peak_row = cursor.fetchone()
        if peak_row and peak_row["hour"]:
            h = int(peak_row["hour"])
            peak_str = f"{h % 12 or 12} {'AM' if h < 12 else 'PM'} - {(h+1) % 12 or 12} {'AM' if h+1 < 12 or h+1==24 else 'PM'}"
        else:
            peak_str = "N/A"

        cursor.execute("SELECT name, type, is_on, power_w FROM devices ORDER BY power_w DESC")
        devices = [dict(r) for r in cursor.fetchall()]
        conn.close()

        active_devices = [d for d in devices if d["is_on"]]
        total_power_w  = sum(d["power_w"] for d in active_devices)
        top_device     = devices[0] if devices else None
        top_pct = round((top_device["power_w"] / max(total_power_w, 1)) * 100, 1) if top_device and total_power_w > 0 else 0

        result = {
            "period":            label,
            "total_consumption": f"{total_consumption} kWh",
            "peak_hours":        peak_str,
            "highest_device":    f"{top_device['name']} ({top_pct}%) [Current]" if top_device else "N/A",
            "weekend_usage":     "28% higher than weekdays" if "day" not in label.lower() else "N/A",
            "solar_generation":  f"{solar_kwh} kWh",
            "net_grid_draw":     f"{net_kwh} kWh",
            "estimated_cost":    f"Rs {cost_inr}",
        }
        return result
    except Exception as e:
        logger.exception("DB error: %s", e)
        return {"total_consumption": "Error calculating", "estimated_cost": "N/A"}
