from fastapi import FastAPI

import app.models.event  # noqa: F401
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.db import Base, engine

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "CaptainHook API is running"}


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(api_router, prefix=settings.API_V1_STR)
