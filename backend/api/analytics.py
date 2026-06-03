from fastapi import APIRouter
import random
from schemas import AnalyticsResponse, EnergyDataPoint

router = APIRouter()

@router.get("/history", response_model=AnalyticsResponse)
def get_analytics_history(period: str = "daily"):
    """Historical energy data. Query param: period (daily/weekly/monthly)."""
    if period == "monthly":
        labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    elif period == "weekly":
        labels = ["Week 1", "Week 2", "Week 3", "Week 4"]
    else:
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    data_points = [
        EnergyDataPoint(
            label=label,
            consumption_kwh=round(random.uniform(12.0, 35.0), 2),
            generation_kwh=round(random.uniform(8.0, 28.0), 2),
        )
        for label in labels
    ]

    return AnalyticsResponse(period=period, data=data_points)
