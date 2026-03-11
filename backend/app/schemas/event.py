from pydantic import BaseModel, ConfigDict
from typing import Literal, Optional
from datetime import date, datetime


class Event(BaseModel):
    """
    Represents an event in the calendar.

    Note:
    When repeat is set to other than "none", the event will be repeated from the selected date.
    """
    
    name: str
    description: str    
    plugin: Optional[str] = None
    date: datetime
    repeat: Literal["none", "daily", "weekly", "monthly", "yearly"] = "none"


class EventRead(Event):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_date: datetime | None = None
    completed_at: datetime | None
    created_at: datetime


class EventCompletionUpdate(BaseModel):
    completed: bool
    occurrence_date: date
