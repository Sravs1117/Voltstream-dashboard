from pydantic import BaseModel
from typing import List

class EnergyDataPoint(BaseModel):
    label: str
    consumption_kwh: float
    generation_kwh: float

class AnalyticsResponse(BaseModel):
    period: str
    data: List[EnergyDataPoint]
