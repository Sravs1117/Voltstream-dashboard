from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from schemas import LivePowerStatus
from core.database import get_db
from db.crud import get_latest_power_reading

router = APIRouter()

@router.get("/live", response_model=LivePowerStatus)
def get_live_power(db: Session = Depends(get_db)):
    """Current grid draw, solar generation, and net usage fetched from SQLite database."""
    reading = get_latest_power_reading(db)
    if not reading:
        return LivePowerStatus(
            grid_draw_kw=0.0,
            solar_gen_kw=0.0,
            net_usage_kw=0.0,
        )
    return LivePowerStatus(
        grid_draw_kw=reading.grid_draw_kw,
        solar_gen_kw=reading.solar_gen_kw,
        net_usage_kw=reading.net_usage_kw,
    )
