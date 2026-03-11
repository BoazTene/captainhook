from fastapi import FastAPI

import app.models.event  # noqa: F401
import app.models.event_completion  # noqa: F401
import app.models.notification_settings  # noqa: F401
import app.models.push_subscription  # noqa: F401
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.db import initialize_database
from app.services.notification_scheduler import (
    start_notification_scheduler,
    stop_notification_scheduler,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)


import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

@app.get("/")
def root() -> dict[str, str]:
    return {"message": "CaptainHook API is running"}


@app.on_event("startup")
def create_tables() -> None:
    initialize_database()
    start_notification_scheduler()


@app.on_event("shutdown")
def stop_background_jobs() -> None:
    stop_notification_scheduler()


app.include_router(api_router, prefix=settings.API_V1_STR)
