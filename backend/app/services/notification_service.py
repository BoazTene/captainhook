from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Protocol

from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.notification_settings import NotificationSettingsModel
from app.models.push_subscription import PushSubscriptionModel
from app.schemas.notification import NotificationSettingsUpdate, PushSubscriptionCreate
from app.services.event_service import list_events_for_day

logger = logging.getLogger(__name__)


class WebPushSender(Protocol):
    def send(self, subscription: PushSubscriptionModel, payload: dict[str, Any]) -> None:
        ...


class NoopWebPushSender:
    def send(self, subscription: PushSubscriptionModel, payload: dict[str, Any]) -> None:
        logger.warning(
            "Web push sender is not configured. Dropping notification for subscription_id=%s title=%s",
            subscription.id,
            payload.get("title"),
        )


class PyWebPushSender:
    def __init__(self, vapid_private_key: str, vapid_subject: str) -> None:
        self.vapid_private_key = vapid_private_key
        self.vapid_subject = vapid_subject

    def send(self, subscription: PushSubscriptionModel, payload: dict[str, Any]) -> None:
        from pywebpush import webpush  # type: ignore

        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=self.vapid_private_key,
            vapid_claims={"sub": self.vapid_subject},
        )


def _build_sender() -> WebPushSender:
    try:
        import pywebpush  # noqa: F401
    except ImportError:
        return NoopWebPushSender()

    if not settings.WEB_PUSH_VAPID_PRIVATE_KEY:
        logger.warning("WEB_PUSH_VAPID_PRIVATE_KEY is missing; using NoopWebPushSender.")
        return NoopWebPushSender()

    return PyWebPushSender(
        vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
        vapid_subject=settings.WEB_PUSH_VAPID_CLAIMS_SUBJECT,
    )


_sender = _build_sender()


def register_subscription(payload: PushSubscriptionCreate) -> PushSubscriptionModel:
    with SessionLocal() as db:
        existing_stmt = select(PushSubscriptionModel).where(PushSubscriptionModel.endpoint == payload.endpoint)
        existing = db.scalar(existing_stmt)
        if existing:
            existing.client_id = payload.client_id
            existing.p256dh = payload.keys.p256dh
            existing.auth = payload.keys.auth
            existing.user_agent = payload.user_agent
            existing.disabled_at = None
            db.commit()
            db.refresh(existing)
            logger.info("Updated existing push subscription id=%s", existing.id)
            return existing

        subscription = PushSubscriptionModel(
            client_id=payload.client_id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=payload.user_agent,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        logger.info("Created push subscription id=%s", subscription.id)
        return subscription


def list_subscriptions(client_id: str | None = None) -> list[PushSubscriptionModel]:
    with SessionLocal() as db:
        stmt = select(PushSubscriptionModel)
        if client_id:
            stmt = stmt.where(PushSubscriptionModel.client_id == client_id)
        stmt = stmt.order_by(PushSubscriptionModel.created_at.desc())
        return list(db.scalars(stmt).all())


def disable_subscription(subscription_id: int) -> None:
    with SessionLocal() as db:
        subscription = db.get(PushSubscriptionModel, subscription_id)
        if subscription is None:
            raise HTTPException(status_code=404, detail=f"Subscription with id {subscription_id} not found.")
        subscription.disabled_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Disabled push subscription id=%s", subscription_id)


def _get_or_create_notification_settings(db) -> NotificationSettingsModel:
    settings_row = db.get(NotificationSettingsModel, 1)
    if settings_row is not None:
        return settings_row

    settings_row = NotificationSettingsModel(id=1)
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def get_notification_settings() -> NotificationSettingsModel:
    with SessionLocal() as db:
        return _get_or_create_notification_settings(db)


def update_notification_settings(payload: NotificationSettingsUpdate) -> NotificationSettingsModel:
    if payload.follow_up_end_hour < payload.follow_up_start_hour:
        raise HTTPException(status_code=400, detail="follow_up_end_hour must be greater than or equal to follow_up_start_hour.")

    with SessionLocal() as db:
        settings_row = _get_or_create_notification_settings(db)
        settings_row.morning_reminder_hour = payload.morning_reminder_hour
        settings_row.follow_up_start_hour = payload.follow_up_start_hour
        settings_row.follow_up_end_hour = payload.follow_up_end_hour
        settings_row.follow_up_interval_hours = payload.follow_up_interval_hours
        db.commit()
        db.refresh(settings_row)
        return settings_row


def _get_local_now() -> datetime:
    return datetime.now().astimezone()


def _format_task_names(events) -> str:
    names = [event.name.strip() for event in events if event.name.strip()]
    if not names:
        return "your tasks"

    preview = ", ".join(names[:3])
    if len(names) <= 3:
        return preview
    return f"{preview}, and {len(names) - 3} more"


def _send_payload_to_active_subscriptions(payload: dict[str, Any]) -> tuple[int, int]:
    sent = 0
    failed = 0

    with SessionLocal() as db:
        subscriptions_stmt = select(PushSubscriptionModel).where(PushSubscriptionModel.disabled_at.is_(None))
        subscriptions = list(db.scalars(subscriptions_stmt).all())

        if not subscriptions:
            logger.debug("Notification dispatch skipped because there are no active subscriptions.")
            return (0, 0)

        for subscription in subscriptions:
            try:
                _sender.send(subscription=subscription, payload=payload)
                sent += 1
                logger.info("Push sent to subscription_id=%s title=%s", subscription.id, payload.get("title"))
            except Exception:
                failed += 1
                logger.exception("Push failed for subscription_id=%s", subscription.id)

    logger.info("Push dispatch completed sent=%s failed=%s title=%s", sent, failed, payload.get("title"))
    return (sent, failed)


def _build_morning_payload(local_now: datetime, events) -> dict[str, Any]:
    return {
        "title": "Reminder to do your tasks today",
        "body": f"Today's tasks: {_format_task_names(events)}.",
        "url": settings.WEB_PUSH_DEFAULT_URL,
        "icon": settings.WEB_PUSH_DEFAULT_ICON,
        "sentAt": local_now.astimezone(timezone.utc).isoformat(),
    }


def _build_follow_up_payload(local_now: datetime, events) -> dict[str, Any]:
    return {
        "title": "Tasks still pending today",
        "body": f"You still have: {_format_task_names(events)}.",
        "url": settings.WEB_PUSH_DEFAULT_URL,
        "icon": settings.WEB_PUSH_DEFAULT_ICON,
        "sentAt": local_now.astimezone(timezone.utc).isoformat(),
    }


def _already_sent_follow_up_this_window(
    local_now: datetime,
    settings_row: NotificationSettingsModel,
) -> bool:
    if settings_row.last_follow_up_sent_at is None:
        return False

    last_sent_local = settings_row.last_follow_up_sent_at.astimezone(local_now.tzinfo)
    return (
        last_sent_local.date() == local_now.date()
        and last_sent_local.hour == local_now.hour
    )


def send_scheduled_notifications() -> tuple[int, int]:
    local_now = _get_local_now()

    with SessionLocal() as db:
        settings_row = _get_or_create_notification_settings(db)
        todays_events = list_events_for_day(local_now.date())
        unfinished_events = [event for event in todays_events if event.completed_at is None]

        if local_now.hour == settings_row.morning_reminder_hour:
            if settings_row.last_morning_sent_on == local_now.date():
                logger.debug("Morning reminder already sent for %s.", local_now.date())
                return (0, 0)
            if not unfinished_events:
                logger.debug("Morning reminder skipped because there are no unfinished events today.")
                return (0, 0)

            result = _send_payload_to_active_subscriptions(_build_morning_payload(local_now, unfinished_events))
            if result[0] > 0:
                settings_row.last_morning_sent_on = local_now.date()
                db.commit()
            return result

        should_send_follow_up = (
            settings_row.follow_up_start_hour <= local_now.hour <= settings_row.follow_up_end_hour
            and settings_row.follow_up_interval_hours > 0
            and (local_now.hour - settings_row.follow_up_start_hour) % settings_row.follow_up_interval_hours == 0
        )
        if not should_send_follow_up:
            logger.debug("No scheduled notification for local hour=%s.", local_now.hour)
            return (0, 0)

        if _already_sent_follow_up_this_window(local_now, settings_row):
            logger.debug("Follow-up reminder already sent for %s %02d:00.", local_now.date(), local_now.hour)
            return (0, 0)

        if not unfinished_events:
            logger.debug("Follow-up reminder skipped because all events are completed.")
            return (0, 0)

        result = _send_payload_to_active_subscriptions(_build_follow_up_payload(local_now, unfinished_events))
        if result[0] > 0:
            settings_row.last_follow_up_sent_at = local_now.astimezone(timezone.utc)
            db.commit()
        return result
