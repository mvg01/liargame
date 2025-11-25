"""
AI Liar Game - FastAPI Backend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from collections import Counter

from models import (
    GameStartRequest,
    GameStartResponse,
    TalkRequest,
    TalkResponse,
    VoteRequest,
    VoteResponse,
    LiarGuessRequest,
    LiarGuessResponse,
)
from game_logic import (
    create_game,
    get_game,
    generate_ai_response,
    add_message_to_history,
    ai_vote,
    liar_guess_keyword,
)
from config import get_settings

# 설정 로드
settings = get_settings()

# FastAPI 앱 생성
app = FastAPI(
    title="AI Liar Game API",
    description="FastAPI와 OpenAI를 활용한 라이어 게임 백엔드",
    version="1.0.0",
)

# CORS 설정 (프론트엔드 연동 시 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """API 루트"""
    return {
        "message": "AI Liar Game API",
        "version": "1.0.0",
        "endpoints": {
            "start": "/start - 게임 시작",
            "talk": "/talk - 대화 진행",
            "vote": "/vote - 투표 및 결과",
            "status": "/status/{session_id} - 게임 상태 조회",
        },
    }


@app.post("/start", response_model=GameStartResponse)
async def start_game(request: GameStartRequest):
    """
    게임 시작

    - 주제어 설정 (None이면 랜덤)
    - 라이어 랜덤 배정
    - AI 역할 설정
    """
    try:
        game = create_game(
            session_id=request.session_id,
            keyword=request.keyword,
            category=request.category
        )

        return GameStartResponse(
            session_id=game.session_id,
            keyword=game.keyword,
            category=game.category,
            liar=game.liar,
            message=f"게임이 시작되었습니다! 카테고리: {game.category}, 주제어: '{game.keyword}' (라이어: {game.liar})",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"게임 생성 실패: {str(e)}")


@app.post("/talk", response_model=TalkResponse)
async def talk(request: TalkRequest):
    """
    대화 진행

    1. 사용자 메시지 추가
    2. AI 3명이 순차적으로 응답
    3. 각 AI는 독립적인 컨텍스트로 동작 (서로의 역할을 모름)
    """
    try:
        game = get_game(request.session_id)

        # 1. 사용자 메시지 추가
        add_message_to_history(request.session_id, "user", request.user_message)

        # 2. AI 응답 생성 (독립적인 스레드)
        ai_responses = {}
        ai_players = ["ai_1", "ai_2", "ai_3"]

        for ai_name in ai_players:
            response = generate_ai_response(request.session_id, ai_name)
            ai_responses[ai_name] = response

            # 공용 히스토리에 추가
            add_message_to_history(request.session_id, ai_name, response)

        # 3. 응답 반환
        return TalkResponse(
            session_id=request.session_id, history=game.history, ai_responses=ai_responses
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대화 처리 실패: {str(e)}")


@app.post("/vote", response_model=VoteResponse)
async def vote(request: VoteRequest):
    """
    투표 및 게임 결과

    1. 사용자 투표 수신
    2. AI 3명이 각각 투표
    3. 결과 집계 및 승패 판정
    """
    try:
        game = get_game(request.session_id)

        # 1. AI 투표 수집
        ai_votes = {}
        ai_players = ["ai_1", "ai_2", "ai_3"]

        for ai_name in ai_players:
            vote_target = ai_vote(request.session_id, ai_name)
            ai_votes[ai_name] = vote_target

        # 2. 득표 집계
        all_votes = [request.user_vote] + list(ai_votes.values())
        vote_counts = dict(Counter(all_votes))

        # 3. 승패 판정
        # 가장 많이 득표한 사람 찾기
        max_votes = max(vote_counts.values())
        most_voted = [player for player, count in vote_counts.items() if count == max_votes]

        # 라이어가 최다 득표자에 포함되는지 확인
        liar_caught = game.liar in most_voted

        if liar_caught:
            result = "라이어가 걸렸습니다! 하지만 라이어에게 마지막 기회가 있습니다."
        else:
            result = "라이어 승리! 라이어가 끝까지 살아남았습니다."

        return VoteResponse(
            session_id=request.session_id,
            user_vote=request.user_vote,
            ai_votes=ai_votes,
            actual_liar=game.liar,
            result=result,
            vote_counts=vote_counts,
            liar_caught=liar_caught,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"투표 처리 실패: {str(e)}")


@app.post("/liar-guess", response_model=LiarGuessResponse)
async def liar_guess(request: LiarGuessRequest):
    """
    라이어 역전 승부

    라이어가 투표에서 걸렸을 때, 키워드를 맞히면 역전 승리
    """
    try:
        result = liar_guess_keyword(request.session_id, request.guess)

        return LiarGuessResponse(
            session_id=request.session_id,
            guess=request.guess,
            correct=result["correct"],
            keyword=result["keyword"],
            result=result["result"],
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"역전 승부 처리 실패: {str(e)}")


@app.get("/status/{session_id}")
async def get_status(session_id: str):
    """
    게임 상태 조회

    - 현재 대화 기록
    - AI 역할 (디버깅용)
    """
    try:
        game = get_game(session_id)

        return {
            "session_id": game.session_id,
            "keyword": game.keyword,
            "category": game.category,
            "liar": game.liar,
            "ai_roles": game.ai_roles,
            "history": game.history,
            "total_messages": len(game.history),
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,  # 개발 모드: 코드 변경 시 자동 재시작
    )
