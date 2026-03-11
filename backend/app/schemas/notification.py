from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    client_id: str = Field(min_length=1, max_length=255)
    endpoint: str = Field(min_length=1, max_length=2000)
    keys: PushSubscriptionKeys
    user_agent: str | None = Field(default=None, max_length=1024)


class PushSubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: str
    endpoint: str
    user_agent: str | None
    created_at: datetime
    disabled_at: datetime | None


class WebPushPublicKeyResponse(BaseModel):
    public_key: str | None


class NotificationSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    morning_reminder_hour: int
    follow_up_start_hour: int
    follow_up_end_hour: int
    follow_up_interval_hours: int


class NotificationSettingsUpdate(BaseModel):
    morning_reminder_hour: int = Field(ge=0, le=23)
    follow_up_start_hour: int = Field(ge=0, le=23)
    follow_up_end_hour: int = Field(ge=0, le=23)
    follow_up_interval_hours: int = Field(ge=1, le=24)
