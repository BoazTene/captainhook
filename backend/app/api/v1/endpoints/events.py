from typing import Literal, Optional
from datetime import datetime

from fastapi import APIRouter, Body

from app.schemas.event import Event, EventRead
from app.schemas.generic_response import GenericResponse
from app.schemas.plugin import EventPluginRequest, EventPluginResponse
from app.services.event_service import create_event, list_events, delete_event
from app.services.plugin_service import run_event_plugin

router = APIRouter()


@router.post("", response_model=EventRead, status_code=201)
def create_event_endpoint(event: Event) -> EventRead:
    return create_event(event)

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


@router.api_route("/{event_id}/plugin", methods=["GET", "POST"], response_model=EventPluginResponse)
def run_event_plugin_endpoint(
    event_id: int,
    payload: EventPluginRequest | None = Body(default=None),
) -> EventPluginResponse:
    additional_data = payload.additional_data if payload else None
    return run_event_plugin(event_id=event_id, additional_data=additional_data)
