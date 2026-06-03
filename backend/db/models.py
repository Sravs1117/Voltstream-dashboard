from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime
import datetime
from core.database import Base


# --- Extracted from analytics feature ---
class PowerReading(Base):
    __tablename__ = "power_readings"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    grid_draw_kw = Column(Float, nullable=False)
    solar_gen_kw = Column(Float, nullable=False)
    net_usage_kw = Column(Float, nullable=False)

# --- Extracted from devices feature ---
class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    is_on = Column(Boolean, default=False)
    power_w = Column(Float, default=0.0)
