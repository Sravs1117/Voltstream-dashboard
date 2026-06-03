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
    gcp_project: str = os.getenv("GOOGLE_CLOUD_PROJECT", "project-8f12ea6a-1eb5-4330-a3b")
    gcp_location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

settings = Settings()
