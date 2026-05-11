from pydantic import BaseModel

class DeviceResponse(BaseModel):
    id: str
    name: str
    type: str
    is_on: bool
    power_w: float

class DeviceUpdate(BaseModel):
    is_on: bool
