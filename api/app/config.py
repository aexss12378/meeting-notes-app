from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_cors_origins: str = "http://localhost:3000"
    redis_url: str = "redis://redis:6379/0"
    data_dir: str = "/data/meetings"
    queue_name: str = "meeting:jobs"
    job_key_prefix: str = "meeting:job"

    retention_days: int = 30
    max_upload_size_mb: int = 300

    transcribe_language: str = "zh"
    whisper_model_size: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_cpu_threads: int = 4
    ollama_base_url: str = ""
    ollama_model: str = "qwen3:14b"
    ollama_api_key: str = ""
    ollama_timeout_seconds: int = 180
    summary_chunk_chars: int = 6000


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_allowed_origins() -> list[str]:
    settings = get_settings()
    return [origin.strip() for origin in settings.api_cors_origins.split(",") if origin.strip()]
