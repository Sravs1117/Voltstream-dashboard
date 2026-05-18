from fastapi import APIRouter, HTTPException, Depends
from typing import List
import asyncio
from sqlalchemy.orm import Session
from schemas.device import DeviceResponse, DeviceUpdate, DeviceCreate
from db.database import get_db
from db.crud import get_devices, get_device, update_device_state, create_device

router = APIRouter()

@router.get("", response_model=List[DeviceResponse])
async def get_all_devices(db: Session = Depends(get_db)):
    """All smart devices and their on/off state fetched from SQLite database."""
    await asyncio.sleep(0.4) # Add small delay to show loading state on frontend
    
    # Power fluctuation is now handled dynamically in the background by TelemetryService!
    devices = get_devices(db)
    return devices

@router.patch("/{device_id}", response_model=DeviceResponse)
def toggle_device(device_id: str, update: DeviceUpdate, db: Session = Depends(get_db)):
    """Toggle device ON/OFF in SQLite database. Return 404 if device not found."""
    device = get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updated_device = update_device_state(db, device_id, update.is_on)
    return updated_device

@router.post("", response_model=DeviceResponse, status_code=201)
def add_device(device: DeviceCreate, db: Session = Depends(get_db)):
    """Register a new smart device in the database. Dynamically generates a clean unique ID from the name."""
    import uuid
    import re
    
    # Create a clean lower-case slug based on the device name
    sanitized_name = re.sub(r'[^a-zA-Z0-9_]', '_', device.name.lower().strip())
    sanitized_name = re.sub(r'_+', '_', sanitized_name).strip('_')
    
    # Fallback if name has no valid alphanumeric characters
    if not sanitized_name:
        sanitized_name = "appliance"
        
    device_id = f"dev_{sanitized_name}_{uuid.uuid4().hex[:4]}"
    
    # In the extremely rare case of ID collision, re-generate
    while get_device(db, device_id) is not None:
        device_id = f"dev_{sanitized_name}_{uuid.uuid4().hex[:4]}"
    
    new_device = create_device(db, id=device_id, name=device.name, type=device.type)
    return new_device

