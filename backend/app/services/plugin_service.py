import importlib.util
from collections.abc import Callable
from pathlib import Path
import re
from typing import Any

from fastapi import HTTPException

from app.core.db import SessionLocal
from app.models.event import EventModel
from app.schemas.plugin import EventPluginResponse

PluginHandler = Callable[[EventModel, dict[str, Any]], dict[str, Any]]
PLUGINS_DIR = Path(__file__).resolve().parents[1] / "plugins"
PLUGIN_ENTRYPOINT = "generate_task"
PLUGIN_NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")


def _default_plugin(event: EventModel, additional_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "custom",
        "summary": f"Generated task for {event.name}",
        "notes": [event.description],
        "additional_data": additional_data,
    }

def _normalize_plugin_name(plugin_name: str) -> str:
    normalized = plugin_name.strip().lower().replace("-", "_").replace(" ", "_")
    if not normalized or not PLUGIN_NAME_PATTERN.fullmatch(normalized):
        raise HTTPException(status_code=400, detail="Invalid plugin name format.")
    return normalized


def _load_plugin_handler(plugin_name: str) -> PluginHandler | None:
    normalized_name = _normalize_plugin_name(plugin_name)
    plugin_path = (PLUGINS_DIR / f"{normalized_name}.py").resolve()
    plugins_dir_resolved = PLUGINS_DIR.resolve()
    if plugin_path.parent != plugins_dir_resolved:
        raise HTTPException(status_code=400, detail="Invalid plugin path.")

    if not plugin_path.is_file():
        return None

    module_name = f"app.plugins.{normalized_name}"
    spec = importlib.util.spec_from_file_location(module_name, plugin_path)
    if spec is None or spec.loader is None:
        raise HTTPException(status_code=500, detail=f"Failed to load plugin '{plugin_name}'.")

    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail=f"Failed to initialize plugin '{plugin_name}'.")

    handler = getattr(module, PLUGIN_ENTRYPOINT, None)
    if not callable(handler):
        raise HTTPException(
            status_code=500,
            detail=f"Plugin '{plugin_name}' is missing callable '{PLUGIN_ENTRYPOINT}'.",
        )

    return handler


def _get_event(event_id: int) -> EventModel:
    with SessionLocal() as db:
        event = db.get(EventModel, event_id)
        if event is None:
            raise HTTPException(status_code=404, detail=f"Event with id {event_id} not found.")
        return event


def run_event_plugin(event_id: int, additional_data: dict[str, Any] | None = None) -> EventPluginResponse:
    event = _get_event(event_id)

    if not event.plugin:
        raise HTTPException(status_code=400, detail="Event has no plugin configured.")

    handler = _load_plugin_handler(event.plugin) or _default_plugin
    try:
        task = handler(event, additional_data or {})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail=f"Plugin '{event.plugin}' execution failed.")

    return EventPluginResponse(
        event_id=event.id,
        event_name=event.name,
        plugin=event.plugin,
        task=task,
    )


def list_available_plugins() -> list[str]:
    plugins_dir_resolved = PLUGINS_DIR.resolve()
    plugin_names: list[str] = []

    for plugin_path in plugins_dir_resolved.glob("*.py"):
        if not plugin_path.is_file() or plugin_path.name == "__init__.py":
            continue

        plugin_name = plugin_path.stem
        if not PLUGIN_NAME_PATTERN.fullmatch(plugin_name):
            continue

        plugin_names.append(plugin_name)

    plugin_names.sort()
    return plugin_names
