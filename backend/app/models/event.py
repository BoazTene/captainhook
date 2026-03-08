from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class EventModel(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    plugin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    repeat: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
