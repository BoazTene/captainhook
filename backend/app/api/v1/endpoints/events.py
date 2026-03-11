from typing import Literal, Optional
from datetime import datetime

from fastapi import APIRouter, Body

from app.schemas.event import Event, EventCompletionUpdate, EventRead
from app.schemas.generic_response import GenericResponse
from app.schemas.plugin import EventPluginRequest, EventPluginResponse
from app.services.event_service import create_event, update_event, list_events, delete_event, set_event_completion
from app.services.plugin_service import run_event_plugin

router = APIRouter()


@router.post("", response_model=EventRead, status_code=201)
def create_event_endpoint(event: Event) -> EventRead:
    return create_event(event)


@router.put("/{event_id}", response_model=EventRead, status_code=200)
def update_event_endpoint(event_id: int, event: Event) -> EventRead:
    return update_event(event_id=event_id, event=event)

@router.delete("/{event_id}", status_code=200, response_model=GenericResponse)
def delete_event_endpoint(event_id: int) -> GenericResponse:
    response = delete_event(event_id)
    return response

@router.get("", response_model=list[EventRead])
def list_events_endpoint(
    date: datetime,
    operator: Literal["on", "from", "until", "between"] = "on",
    date_to: Optional[datetime] = None,
) -> list[EventRead]:
    return list_events(date=date, operator=operator, date_to=date_to)


@router.patch("/{event_id}/completion", response_model=EventRead, status_code=200)
def set_event_completion_endpoint(
    event_id: int,
    payload: EventCompletionUpdate,
) -> EventRead:
    return set_event_completion(event_id=event_id, completed=payload.completed)


@router.get("/{event_id}/plugin", response_model=EventPluginResponse)
def run_event_plugin_get_endpoint(
    event_id: int,
) -> EventPluginResponse:
    return run_event_plugin(event_id=event_id, additional_data=None)


@router.post("/{event_id}/plugin", response_model=EventPluginResponse)
def run_event_plugin_post_endpoint(
    event_id: int,
    payload: EventPluginRequest | None = Body(default=None),
) -> EventPluginResponse:
    additional_data = payload.additional_data if payload else None
    return run_event_plugin(event_id=event_id, additional_data=additional_data)
