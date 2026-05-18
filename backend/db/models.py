import datetime
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime
from db.database import Base

class Device(Base):
    """Represents a smart device connected to VoltStream."""
    __tablename__ = "devices"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    is_on = Column(Boolean, default=False)
    power_w = Column(Float, default=0.0)


class PowerReading(Base):
    """Represents real-time solar generation, grid draw, and net usage."""
    __tablename__ = "power_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    grid_draw_kw = Column(Float, nullable=False)
    solar_gen_kw = Column(Float, nullable=False)
    net_usage_kw = Column(Float, nullable=False)
