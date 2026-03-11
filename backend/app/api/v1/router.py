from fastapi import APIRouter

from app.api.v1.endpoints import events, health, notifications, plugins

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(plugins.router, prefix="/plugins", tags=["plugins"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
