import logging
import threading
from datetime import datetime, timedelta

from app.services.notification_service import send_scheduled_notifications

logger = logging.getLogger(__name__)

_scheduler_lock = threading.Lock()
_scheduler_thread: threading.Thread | None = None
_stop_event: threading.Event | None = None
_INTERVAL_SECONDS = 60 * 60


def _seconds_until_next_hour() -> float:
    now = datetime.now().astimezone()
    next_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return max((next_hour - now).total_seconds(), 1.0)


def _run_scheduler(stop_event: threading.Event) -> None:
    logger.info("Notification scheduler started (interval=%ss).", _INTERVAL_SECONDS)

    while not stop_event.is_set():
        try:
            sent, failed = send_scheduled_notifications()
            logger.info("Notification tick sent=%s failed=%s", sent, failed)
        except Exception:
            logger.exception("Notification tick failed.")

        if stop_event.wait(_seconds_until_next_hour()):
            break

    logger.info("Notification scheduler stopped.")


def start_notification_scheduler() -> None:
    global _scheduler_thread, _stop_event

    with _scheduler_lock:
        if _scheduler_thread is not None and _scheduler_thread.is_alive():
            logger.info("Notification scheduler already running; skipping duplicate start.")
            return

        _stop_event = threading.Event()
        _scheduler_thread = threading.Thread(
            target=_run_scheduler,
            kwargs={"stop_event": _stop_event},
            name="notification-scheduler",
            daemon=True,
        )
        _scheduler_thread.start()


def stop_notification_scheduler(timeout_seconds: float = 5.0) -> None:
    global _scheduler_thread, _stop_event

    with _scheduler_lock:
        if _scheduler_thread is None or _stop_event is None:
            logger.info("Notification scheduler stop requested but scheduler is not running.")
            return

        logger.info("Stopping notification scheduler...")
        _stop_event.set()
        _scheduler_thread.join(timeout=timeout_seconds)
        if _scheduler_thread.is_alive():
            logger.warning("Notification scheduler thread did not stop within %ss timeout.", timeout_seconds)
        _scheduler_thread = None
        _stop_event = None
