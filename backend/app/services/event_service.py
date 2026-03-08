from typing import Literal, Optional

from fastapi import HTTPException

from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.event import EventModel
from app.schemas.event import Event
from app.schemas.generic_response import GenericResponse


def create_event(event: Event) -> EventModel:
    with SessionLocal() as db:
        event_model = EventModel(**event.model_dump())
        db.add(event_model)
        db.commit()
        db.refresh(event_model)
        return event_model


def delete_event(event_id: int) -> GenericResponse:
    with SessionLocal() as db:
        event = db.get(EventModel, event_id)
        if event:
            db.delete(event)
            db.commit()

            return GenericResponse(message=f"Event with id {event_id} deleted successfully.")
        else:
            raise HTTPException(status_code=404, detail=f"Event with id {event_id} not found.")


def list_events(
    date: datetime,
    operator: Literal["on", "from", "until", "between"] = "on",
    date_to: Optional[datetime] = None,
) -> list[EventModel]:
    with SessionLocal() as db:
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        if operator == "on":
            stmt = select(EventModel).where(EventModel.date >= day_start, EventModel.date < day_end)
        elif operator == "from":
            stmt = select(EventModel).where(EventModel.date >= day_start)
        elif operator == "until":
            stmt = select(EventModel).where(EventModel.date < day_end)
        elif operator == "between":
            if date_to is None:
                raise HTTPException(status_code=400, detail="date_to is required when operator is 'between'.")

            range_end_start = date_to.replace(hour=0, minute=0, second=0, microsecond=0)
            if range_end_start < day_start:
                raise HTTPException(status_code=400, detail="date_to must be greater than or equal to date.")

            range_end = range_end_start + timedelta(days=1)
            stmt = select(EventModel).where(EventModel.date >= day_start, EventModel.date < range_end)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operator '{operator}'.")

        return list(db.scalars(stmt).all())
