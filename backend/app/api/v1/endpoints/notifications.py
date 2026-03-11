from fastapi import APIRouter, Query

from app.core.config import settings
from app.schemas.generic_response import GenericResponse
from app.schemas.notification import (
    NotificationSettingsRead,
    NotificationSettingsUpdate,
    PushSubscriptionCreate,
    PushSubscriptionRead,
    WebPushPublicKeyResponse,
)
from app.services.notification_service import (
    disable_subscription,
    get_notification_settings,
    list_subscriptions,
    register_subscription,
    update_notification_settings,
)

router = APIRouter()


@router.get("/public-key", response_model=WebPushPublicKeyResponse, status_code=200)
def public_key_endpoint() -> WebPushPublicKeyResponse:
    return WebPushPublicKeyResponse(public_key=settings.WEB_PUSH_VAPID_PUBLIC_KEY)


@router.get("/settings", response_model=NotificationSettingsRead, status_code=200)
def notification_settings_endpoint() -> NotificationSettingsRead:
    return get_notification_settings()


@router.patch("/settings", response_model=NotificationSettingsRead, status_code=200)
def update_notification_settings_endpoint(payload: NotificationSettingsUpdate) -> NotificationSettingsRead:
    return update_notification_settings(payload)


@router.post("/subscriptions", response_model=PushSubscriptionRead, status_code=201)
def register_subscription_endpoint(payload: PushSubscriptionCreate) -> PushSubscriptionRead:
    return register_subscription(payload)


@router.get("/subscriptions", response_model=list[PushSubscriptionRead], status_code=200)
def list_subscriptions_endpoint(client_id: str | None = Query(default=None)) -> list[PushSubscriptionRead]:
    return list_subscriptions(client_id=client_id)


@router.delete("/subscriptions/{subscription_id}", response_model=GenericResponse, status_code=200)
def disable_subscription_endpoint(subscription_id: int) -> GenericResponse:
    disable_subscription(subscription_id=subscription_id)
    return GenericResponse(message=f"Subscription with id {subscription_id} disabled successfully.")
