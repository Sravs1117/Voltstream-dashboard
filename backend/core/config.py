class Settings:
    app_name: str = "VoltStream API"
    version: str = "2.0.0"
    cors_origins: list[str] = [
        "http://127.0.0.1:5173",
        "https://voltstream-2c5fe.web.app"
    ]

settings = Settings()
