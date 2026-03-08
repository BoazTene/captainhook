from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CaptainHook API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
