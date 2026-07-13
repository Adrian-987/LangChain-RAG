import secrets
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# config.py is in backend/app; the backend folder owns its local .env and data.
BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "企业知识库 RAG"
    # A local fallback must never be a public, predictable JWT signing key.
    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    access_token_expire_minutes: int = 60 * 24
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    chroma_dir: Path = BASE_DIR / "data" / "chroma"
    max_upload_mb: int = 20
    llm_base_url: str = "https://ws-toidve3dgmdnheo1.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "kimi-k2.5"
    dashscope_api_key: str = ""
    # Reuse the configured Bailian-compatible endpoint instead of downloading a model from Hugging Face.
    embedding_model: str = "local-chinese-char-ngram"
    retrieval_k: int = 4
    similarity_threshold: float = 0.35
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.chroma_dir.mkdir(parents=True, exist_ok=True)
(BASE_DIR / "data").mkdir(exist_ok=True)
