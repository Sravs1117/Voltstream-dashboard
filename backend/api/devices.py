from fastapi import APIRouter, HTTPException
from typing import List
import asyncio
import random
from schemas.device import DeviceResponse, DeviceUpdate
from db.mock_db import mock_devices

router = APIRouter()

@router.get("", response_model=List[DeviceResponse])
async def get_all_devices():
    """All smart devices and their on/off state."""
    await asyncio.sleep(0.4) # Add small delay to show loading state on frontend
    
    # Fluctuate power usage slightly for "live" feel
    for dev in mock_devices.values():
        if dev["is_on"] and dev["power_w"] > 0:
            dev["power_w"] = max(0, round(dev["power_w"] + random.uniform(-10.5, 12.5), 1))
            
    return list(mock_devices.values())

@router.patch("/{device_id}", response_model=DeviceResponse)
def toggle_device(device_id: str, update: DeviceUpdate):
    """Toggle device ON/OFF. Return 404 if device not found."""
    if device_id not in mock_devices:
        raise HTTPException(status_code=404, detail="Device not found")

    device = mock_devices[device_id]
    device["is_on"] = update.is_on

    if device["is_on"] and device["power_w"] == 0:
        device["power_w"] = round(random.uniform(200.0, 2000.0), 1)
    elif not device["is_on"]:
        device["power_w"] = 0.0

    return device
