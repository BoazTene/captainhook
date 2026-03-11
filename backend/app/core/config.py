from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CaptainHook API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    WEB_PUSH_VAPID_PUBLIC_KEY: str | None = None
    WEB_PUSH_VAPID_PRIVATE_KEY: str | None = None
    WEB_PUSH_VAPID_CLAIMS_SUBJECT: str = "mailto:captainhook@example.com"
    WEB_PUSH_DEFAULT_URL: str = "/"
    WEB_PUSH_DEFAULT_ICON: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
