from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class NotificationSettingsModel(Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    morning_reminder_hour: Mapped[int] = mapped_column(nullable=False, default=9)
    follow_up_start_hour: Mapped[int] = mapped_column(nullable=False, default=15)
    follow_up_end_hour: Mapped[int] = mapped_column(nullable=False, default=22)
    follow_up_interval_hours: Mapped[int] = mapped_column(nullable=False, default=1)
    last_morning_sent_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_follow_up_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
