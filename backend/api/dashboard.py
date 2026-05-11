from fastapi import APIRouter
import random
from schemas.dashboard import LivePowerStatus

router = APIRouter()

@router.get("/live", response_model=LivePowerStatus)
def get_live_power():
    """Current grid draw, solar generation, and net usage."""
    solar = round(random.uniform(2.5, 6.0), 2)
    grid = round(random.uniform(0.8, 3.5), 2)
    net = round(grid - solar, 2)
    return LivePowerStatus(
        grid_draw_kw=grid,
        solar_gen_kw=solar,
        net_usage_kw=net,
    )
