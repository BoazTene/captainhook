from typing import Literal, Optional

from fastapi import HTTPException

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.event_completion import EventCompletionModel
from app.models.event import EventModel
from app.schemas.event import Event, EventRead
from app.schemas.generic_response import GenericResponse


def create_event(event: Event) -> EventModel:
    with SessionLocal() as db:
        event_model = EventModel(**event.model_dump())
        db.add(event_model)
        db.commit()
        db.refresh(event_model)
        return event_model


def update_event(event_id: int, event: Event) -> EventModel:
    with SessionLocal() as db:
        event_model = db.get(EventModel, event_id)
        if event_model is None:
            raise HTTPException(status_code=404, detail=f"Event with id {event_id} not found.")

        payload = event.model_dump()
        event_model.name = payload["name"]
        event_model.description = payload["description"]
        event_model.plugin = payload["plugin"]
        event_model.date = payload["date"]
        event_model.repeat = payload["repeat"]
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
) -> list[EventRead]:
    with SessionLocal() as db:
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        if operator == "on":
            occurrence_dates = [day_start.date()]
        elif operator == "from":
            stmt = select(EventModel).where(EventModel.date >= day_start)
            return [_build_event_read(event, event.date, None) for event in db.scalars(stmt).all()]
        elif operator == "until":
            stmt = select(EventModel).where(EventModel.date < day_end)
            return [_build_event_read(event, event.date, None) for event in db.scalars(stmt).all()]
        elif operator == "between":
            if date_to is None:
                raise HTTPException(status_code=400, detail="date_to is required when operator is 'between'.")

            range_end_start = date_to.replace(hour=0, minute=0, second=0, microsecond=0)
            if range_end_start < day_start:
                raise HTTPException(status_code=400, detail="date_to must be greater than or equal to date.")

            occurrence_dates = [
                (day_start + timedelta(days=offset)).date()
                for offset in range((range_end_start.date() - day_start.date()).days + 1)
            ]
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operator '{operator}'.")

        events = list(db.scalars(select(EventModel)).all())
        return _expand_events_for_occurrence_dates(db, events, occurrence_dates)


def set_event_completion(event_id: int, completed: bool, occurrence_date: date) -> EventRead:
    with SessionLocal() as db:
        event = db.get(EventModel, event_id)
        if event is None:
            raise HTTPException(status_code=404, detail=f"Event with id {event_id} not found.")

        completion_stmt = select(EventCompletionModel).where(
            EventCompletionModel.event_id == event_id,
            EventCompletionModel.occurrence_date == occurrence_date,
        )
        completion = db.scalar(completion_stmt)

        if completed:
            if completion is None:
                completion = EventCompletionModel(
                    event_id=event_id,
                    occurrence_date=occurrence_date,
                )
                db.add(completion)
            else:
                completion.completed_at = datetime.now(timezone.utc)
        elif completion is not None:
            db.delete(completion)

        db.commit()
        return _build_event_read(
            event,
            _build_occurrence_datetime(event, occurrence_date),
            completion.completed_at if completed else None,
        )


def list_events_for_day(target_date: date) -> list[EventRead]:
    with SessionLocal() as db:
        events = list(db.scalars(select(EventModel)).all())
        return _expand_events_for_occurrence_dates(db, events, [target_date])


def _build_event_read(event: EventModel, occurrence_datetime: datetime, completed_at: datetime | None) -> EventRead:
    return EventRead.model_validate(
        {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "plugin": event.plugin,
            "date": occurrence_datetime,
            "original_date": event.date,
            "repeat": event.repeat,
            "completed_at": completed_at,
            "created_at": event.created_at,
        }
    )


def _build_occurrence_datetime(event: EventModel, occurrence_date: date) -> datetime:
    event_datetime = event.date
    if event_datetime.tzinfo is None:
        event_datetime = event_datetime.replace(tzinfo=timezone.utc)

    occurrence_datetime = datetime.combine(occurrence_date, event_datetime.timetz())
    if occurrence_datetime.tzinfo is None:
        occurrence_datetime = occurrence_datetime.replace(tzinfo=event_datetime.tzinfo)
    return occurrence_datetime


def _matches_occurrence(event: EventModel, occurrence_date: date) -> bool:
    start_date = event.date.date()
    if occurrence_date < start_date:
        return False

    if event.repeat == "none":
        return occurrence_date == start_date
    if event.repeat == "daily":
        return True
    if event.repeat == "weekly":
        return occurrence_date.weekday() == start_date.weekday()
    if event.repeat == "monthly":
        return occurrence_date.day == start_date.day
    if event.repeat == "yearly":
        return occurrence_date.month == start_date.month and occurrence_date.day == start_date.day
    return False


def _expand_events_for_occurrence_dates(
    db,
    events: list[EventModel],
    occurrence_dates: list[date],
) -> list[EventRead]:
    if not occurrence_dates:
        return []

    completion_stmt = select(EventCompletionModel).where(EventCompletionModel.occurrence_date.in_(occurrence_dates))
    completions = list(db.scalars(completion_stmt).all())
    completion_map = {
        (completion.event_id, completion.occurrence_date): completion.completed_at
        for completion in completions
    }

    expanded: list[EventRead] = []
    for occurrence_date in occurrence_dates:
      for event in events:
        if not _matches_occurrence(event, occurrence_date):
            continue

        expanded.append(
            _build_event_read(
                event,
                _build_occurrence_datetime(event, occurrence_date),
                completion_map.get((event.id, occurrence_date)),
            )
        )

    expanded.sort(key=lambda event: (event.date, event.id))
    return expanded
