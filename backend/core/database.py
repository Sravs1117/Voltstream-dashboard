import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database URL for SQLite (creates a file 'voltstream.db' in the backend directory)
DATABASE_URL = "sqlite:///./db/voltstream.db"

# Create the SQLite engine
# connect_args={"check_same_thread": False} is required for SQLite to support multi-threading in FastAPI
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a thread-local session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

# Dependency to get the database session in FastAPI routers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
