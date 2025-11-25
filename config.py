"""
환경 변수 및 설정 관리
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # OpenAI API 설정
    openai_api_key: str
    openai_model: str = "gpt-4o"

    # 서버 설정
    host: str = "0.0.0.0"
    port: int = 8000

    # 게임 설정
    max_history_length: int = 20

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """설정 인스턴스 반환 (캐싱)"""
    return Settings()
