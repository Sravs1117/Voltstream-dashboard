from pydantic import BaseModel

class LivePowerStatus(BaseModel):
    grid_draw_kw: float
    solar_gen_kw: float
    net_usage_kw: float
