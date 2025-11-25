"""
Pydantic 모델 정의
"""
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from enum import Enum


class PlayerRole(str, Enum):
    """플레이어 역할"""

    CIVILIAN = "civilian"
    LIAR = "liar"


class Message(BaseModel):
    """대화 메시지"""

    speaker: str = Field(..., description="발언자 (user, ai_1, ai_2, ai_3)")
    content: str = Field(..., description="발언 내용")


class GameStartRequest(BaseModel):
    """게임 시작 요청"""

    session_id: str = Field(..., description="세션 ID (고유 식별자)")
    keyword: Optional[str] = Field(None, description="게임 주제어 (None이면 랜덤)")
    category: Optional[str] = Field(None, description="카테고리 (keyword가 None이면 자동)")


class GameStartResponse(BaseModel):
    """게임 시작 응답"""

    session_id: str
    keyword: str
    category: str
    liar: str = Field(..., description="라이어 AI (ai_1, ai_2, ai_3)")
    message: str


class TalkRequest(BaseModel):
    """대화 요청"""

    session_id: str
    user_message: str = Field(..., description="사용자 발언")


class TalkResponse(BaseModel):
    """대화 응답"""

    session_id: str
    history: List[Message] = Field(..., description="전체 대화 기록")
    ai_responses: dict = Field(..., description="AI 응답 {'ai_1': '...', 'ai_2': '...', 'ai_3': '...'}")


class VoteRequest(BaseModel):
    """투표 요청"""

    session_id: str
    user_vote: Literal["ai_1", "ai_2", "ai_3"] = Field(..., description="사용자가 선택한 라이어")


class VoteResponse(BaseModel):
    """투표 응답"""

    session_id: str
    user_vote: str
    ai_votes: dict = Field(..., description="AI들의 투표 {'ai_1': '...', 'ai_2': '...', 'ai_3': '...'}")
    actual_liar: str
    result: str = Field(..., description="게임 결과 (시민 승리 / 라이어 승리)")
    vote_counts: dict = Field(..., description="득표 결과")
    liar_caught: bool = Field(..., description="라이어가 걸렸는지 여부")


class LiarGuessRequest(BaseModel):
    """라이어 역전 승부 요청"""

    session_id: str
    guess: str = Field(..., description="라이어가 추측한 키워드")


class LiarGuessResponse(BaseModel):
    """라이어 역전 승부 응답"""

    session_id: str
    guess: str
    correct: bool
    keyword: str
    result: str = Field(..., description="역전 승부 결과")


class GameState(BaseModel):
    """게임 상태 (내부 사용)"""

    session_id: str
    keyword: str
    category: str
    liar: str
    ai_roles: dict = Field(..., description="AI별 역할 {'ai_1': 'civilian', 'ai_2': 'liar', ...}")
    history: List[Message] = Field(default_factory=list, description="대화 기록")
    started: bool = True
