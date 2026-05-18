import random
from sqlalchemy.orm import Session
from db.models import Device, PowerReading
from db.mock_db import mock_devices

def seed_db(db: Session):
    """Seeds the database with initial mock devices and a power reading if empty."""
    # Seed devices if not present
    device_count = db.query(Device).count()
    if device_count == 0:
        print("🌱 Seeding database with initial smart devices...")
        for dev_id, data in mock_devices.items():
            db_dev = Device(
                id=data["id"],
                name=data["name"],
                type=data["type"],
                is_on=data["is_on"],
                power_w=data["power_w"]
            )
            db.add(db_dev)
        db.commit()
        print("✅ Smart devices seeded successfully.")

    # Seed initial power reading if not present
    reading_count = db.query(PowerReading).count()
    if reading_count == 0:
        print("🌱 Seeding database with initial power reading...")
        initial_reading = PowerReading(
            grid_draw_kw=1.8,
            solar_gen_kw=3.5,
            net_usage_kw=-1.7
        )
        db.add(initial_reading)
        db.commit()
        print("✅ Power readings seeded successfully.")


def get_devices(db: Session):
    """Retrieves all smart devices from the database."""
    return db.query(Device).all()


def get_device(db: Session, device_id: str):
    """Retrieves a single device by ID."""
    return db.query(Device).filter(Device.id == device_id).first()


def update_device_state(db: Session, device_id: str, is_on: bool):
    """Toggles a device and calculates its power draw dynamically."""
    device = get_device(db, device_id)
    if not device:
        return None

    device.is_on = is_on
    if is_on:
        # If toggled ON, assign a realistic power draw
        device.power_w = round(random.uniform(200.0, 2000.0), 1)
    else:
        device.power_w = 0.0

    db.commit()
    db.refresh(device)
    return device


def fluctuate_active_devices_power(db: Session):
    """Slightly fluctuates the power draw of active devices for a 'live' realistic feel."""
    active_devices = db.query(Device).filter(Device.is_on == True, Device.power_w > 0).all()
    for dev in active_devices:
        dev.power_w = max(0, round(dev.power_w + random.uniform(-10.5, 12.5), 1))
    if active_devices:
        db.commit()


def get_latest_power_reading(db: Session):
    """Fetches the absolute latest solar and grid power reading."""
    return db.query(PowerReading).order_by(PowerReading.timestamp.desc()).first()


def add_power_reading(db: Session, grid_draw_kw: float, solar_gen_kw: float):
    """Adds a new real-time solar/grid telemetry reading to the database."""
    net_usage_kw = round(grid_draw_kw - solar_gen_kw, 2)
    reading = PowerReading(
        grid_draw_kw=grid_draw_kw,
        solar_gen_kw=solar_gen_kw,
        net_usage_kw=net_usage_kw
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def create_device(db: Session, id: str, name: str, type: str):
    """Creates and persists a new smart device in the SQLite database."""
    db_device = Device(
        id=id,
        name=name,
        type=type,
        is_on=False,  # Defaults to turned OFF
        power_w=0.0
    )
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

