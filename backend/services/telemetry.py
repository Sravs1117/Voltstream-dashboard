import asyncio
import logging
import random
from sqlalchemy.orm import Session
from core.database import SessionLocal
from db.crud import fluctuate_active_devices_power, get_devices
from db.crud import add_power_reading

logger = logging.getLogger(__name__)

class TelemetryService:
    """Simulates real-time solar generation and grid telemetry, storing readings in the SQLite database."""

    def __init__(self):
        self._running = False
        self._task = None

    def start(self):
        """Starts the background simulation loop."""
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._simulation_loop())
            logger.info("📡 Telemetry simulation worker started.")

    def stop(self):
        """Stops the background simulation loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            logger.info("📡 Telemetry simulation worker stopped.")

    async def _simulation_loop(self):
        while self._running:
            try:
                # Open a new database session
                db: Session = SessionLocal()
                try:
                    # 1. Fluctuates active device power values slightly for realistic flow
                    fluctuate_active_devices_power(db)

                    # 2. Get currently active devices to dynamically affect grid draw
                    devices = get_devices(db)
                    total_device_kw = sum(dev.power_w for dev in devices if dev.is_on) / 1000.0

                    # 3. Simulate solar generation (fluctuating between 2.0 and 5.5 kW)
                    solar = round(random.uniform(2.0, 5.5), 2)

                    # 4. Grid draw: Base house load (e.g. 0.4 kW) + active devices + slight fluctuation
                    base_house_load = 0.4
                    noise = random.uniform(-0.15, 0.15)
                    grid = round(max(0.1, base_house_load + total_device_kw + noise), 2)

                    # 5. Save the reading to the database
                    add_power_reading(db, grid_draw_kw=grid, solar_gen_kw=solar)

                except Exception as e:
                    logger.error(f"❌ Error in telemetry simulation: {e}")
                finally:
                    db.close()

                # Simulate a data fetch every 3 seconds
                await asyncio.sleep(3)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Critical error in simulation loop: {e}")
                await asyncio.sleep(5)

# Singleton instance
telemetry_service = TelemetryService()
