from fastapi import APIRouter

from app.services.plugin_service import list_available_plugins

router = APIRouter()


@router.get("", response_model=list[str])
def list_plugins_endpoint() -> list[str]:
    return list_available_plugins()
