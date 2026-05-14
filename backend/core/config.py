import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    app_name: str = "VoltStream API"
    version: str = "2.0.0"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://voltstream-2c5fe.web.app"
    ]
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")

settings = Settings()
