from typing import Any

from pydantic import BaseModel, Field


class EventPluginRequest(BaseModel):
    additional_data: dict[str, Any] = Field(default_factory=dict)


class EventPluginResponse(BaseModel):
    event_id: int
    event_name: str
    plugin: str
    task: dict[str, Any]
