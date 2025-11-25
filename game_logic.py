"""
게임 로직 및 AI 상호작용
"""
import random
import json
from pathlib import Path
from typing import Dict, List, Tuple
from openai import OpenAI
from config import get_settings
from models import GameState, Message, PlayerRole

# 설정 로드
settings = get_settings()

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=settings.openai_api_key)

# 게임 상태 저장소 (In-Memory)
# 실제 배포 시에는 Redis 등의 외부 스토리지 사용 권장
game_sessions: Dict[str, GameState] = {}

# word.json 로드
def load_word_data() -> Dict[str, List[str]]:
    """word.json 파일에서 카테고리별 단어 목록 로드"""
    word_file = Path(__file__).parent / "word.json"
    with open(word_file, "r", encoding="utf-8") as f:
        return json.load(f)

def get_random_keyword() -> Tuple[str, str]:
    """
    랜덤 카테고리와 키워드 반환

    Returns:
        Tuple[str, str]: (카테고리, 키워드)
    """
    word_data = load_word_data()
    category = random.choice(list(word_data.keys()))
    keyword = random.choice(word_data[category])
    return category, keyword


def create_game(session_id: str, keyword: str = None, category: str = None) -> GameState:
    """
    새 게임 생성

    Args:
        session_id: 세션 고유 ID
        keyword: 게임 주제어 (None이면 랜덤)
        category: 카테고리 (keyword가 None이면 자동 설정)

    Returns:
        GameState: 생성된 게임 상태
    """
    # keyword가 없으면 랜덤 선택
    if keyword is None:
        category, keyword = get_random_keyword()

    # 라이어 랜덤 선정
    ai_players = ["ai_1", "ai_2", "ai_3"]
    liar = random.choice(ai_players)

    # 역할 배정
    ai_roles = {ai: PlayerRole.LIAR if ai == liar else PlayerRole.CIVILIAN for ai in ai_players}

    # 발언 순서 랜덤 설정 (user 포함)
    all_players = ["user", "ai_1", "ai_2", "ai_3"]
    turn_order = random.sample(all_players, len(all_players))

    # 게임 상태 생성
    game = GameState(
        session_id=session_id,
        keyword=keyword,
        category=category,
        liar=liar,
        ai_roles=ai_roles,
        history=[],
        turn_order=turn_order,
        current_turn=0,
        started=True,
    )

    # 저장
    game_sessions[session_id] = game

    return game


def get_game(session_id: str) -> GameState:
    """게임 상태 조회"""
    if session_id not in game_sessions:
        raise ValueError(f"Session {session_id} not found")
    return game_sessions[session_id]


def _build_system_prompt(role: PlayerRole, keyword: str, category: str = None) -> str:
    """
    역할에 따른 시스템 프롬프트 생성

    Args:
        role: 플레이어 역할 (CIVILIAN or LIAR)
        keyword: 게임 주제어
        category: 카테고리 (라이어에게만 제공)

    Returns:
        str: 시스템 프롬프트
    """
    if role == PlayerRole.CIVILIAN:
        return f"""당신은 '라이어 게임'에 참여하는 시민(Civilian) AI입니다.

**게임 규칙:**
- 주제어는 '{keyword}'입니다.
- 당신은 이 주제어를 알고 있지만, 다른 AI 중 한 명은 라이어로서 주제어를 모릅니다.
- 목표: 라이어를 찾아내는 것입니다.

**발언 전략:**
1. 주제어를 너무 직접적으로 설명하지 마세요. 라이어가 쉽게 눈치챌 수 있습니다.
2. 하지만 너무 엉뚱한 말을 하면 동료 시민들이 당신을 의심할 수 있습니다.
3. 주제어와 관련된 간접적인 힌트나 연상되는 표현을 사용하세요.
4. 짧고 자연스럽게 대답하세요 (1-2문장).
5. 이전 대화를 보고 누가 라이어인지 추리하세요.

**중요:** 당신은 반드시 '{keyword}'에 대해 알고 있는 사람처럼 행동해야 합니다."""

    else:  # LIAR
        return f"""당신은 '라이어 게임'에 참여하는 라이어(Liar) AI입니다.

**게임 규칙:**
- 다른 플레이어들은 공통 주제어를 알고 있지만, 당신은 주제어를 모릅니다.
- 카테고리는 '{category}'입니다. (이것만 알고 있습니다)
- 목표: 들키지 않고 시민인 척하는 것입니다.

**발언 전략:**
1. 카테고리 '{category}' 안에서만 발언하세요. 절대 다른 카테고리의 것을 언급하지 마세요.
2. 이전 대화에서 다른 플레이어들이 어떤 힌트를 주는지 주의깊게 관찰하세요.
3. 해당 카테고리 내에서 일반적이고 흔한 특징이나 표현을 사용하세요.
4. 예시:
   - 카테고리가 '과일'이면: "달콤해", "비타민이 많아", "색깔이 예뻐" 등
   - 카테고리가 '영화'면: "감동적이었어", "배우 연기가 좋았어", "스토리가 인상적이야" 등
   - 카테고리가 '나라'면: "여행 가고 싶어", "문화가 독특해", "음식이 맛있어" 등
5. 절대 "모르겠다" "잘 모르겠어" 같은 티를 내지 마세요.
6. 확신에 차서 자연스럽게, 마치 알고 있는 것처럼 대답하세요 (1-2문장).
7. 너무 구체적으로 특정 대상을 지목하면 틀릴 수 있으니 애매하고 일반적으로 말하세요.

**중요:**
- 반드시 '{category}' 카테고리 안에서만 발언하세요.
- 주제어를 모르지만, '{category}' 중 하나에 대해 아는 척해야 합니다.
- 다른 플레이어들의 발언을 보고 그들이 말하는 방향을 따라가세요."""


def generate_ai_response(session_id: str, ai_name: str) -> str:
    """
    특정 AI의 응답 생성 (독립적인 스레드로 동작)

    Args:
        session_id: 세션 ID
        ai_name: AI 이름 (ai_1, ai_2, ai_3)

    Returns:
        str: AI 응답
    """
    game = get_game(session_id)

    # 해당 AI의 역할 및 주제어
    role = game.ai_roles[ai_name]
    keyword = game.keyword
    category = game.category

    # 시스템 프롬프트 생성 (역할에 따라 다름)
    system_prompt = _build_system_prompt(role, keyword, category)

    # 대화 기록을 OpenAI 메시지 형식으로 변환
    # 최근 N개만 전송하여 토큰 비용 절감 (옵션)
    recent_history = game.history[-settings.max_history_length :]

    messages = [{"role": "system", "content": system_prompt}]

    for msg in recent_history:
        messages.append(
            {
                "role": "user" if msg.speaker == "user" else "assistant",
                "content": f"[{msg.speaker}]: {msg.content}",
            }
        )

    # 현재 턴 안내
    messages.append({"role": "user", "content": f"이제 당신({ai_name})의 차례입니다. 간단히 대답하세요."})

    # OpenAI API 호출
    try:
        response = client.chat.completions.create(
            model=settings.openai_model, messages=messages, temperature=0.8, max_tokens=150
        )

        ai_response = response.choices[0].message.content.strip()
        return ai_response

    except Exception as e:
        return f"[오류] AI 응답 생성 실패: {str(e)}"


def add_message_to_history(session_id: str, speaker: str, content: str):
    """대화 기록에 메시지 추가"""
    game = get_game(session_id)
    game.history.append(Message(speaker=speaker, content=content))


def ai_vote(session_id: str, ai_name: str) -> str:
    """
    AI가 라이어를 투표

    Args:
        session_id: 세션 ID
        ai_name: 투표하는 AI 이름

    Returns:
        str: 투표 대상 (ai_1, ai_2, ai_3, user)
    """
    game = get_game(session_id)
    role = game.ai_roles[ai_name]
    keyword = game.keyword

    # 투표 프롬프트
    if role == PlayerRole.CIVILIAN:
        vote_prompt = f"""당신은 시민이며 주제어는 '{keyword}'입니다.

지금까지의 대화를 보고, 누가 라이어(주제어를 모르는 사람)인 것 같은지 판단하세요.

**투표 대상:**
- user (사용자)
- ai_1
- ai_2
- ai_3

**중요:** 자신({ai_name})은 투표할 수 없습니다. 반드시 다른 사람 중 한 명을 선택하세요.

투표 대상의 이름만 정확히 출력하세요. (예: user, ai_1, ai_2, ai_3)"""
    else:  # LIAR
        vote_prompt = f"""당신은 라이어입니다. 주제어를 모르지만 들키지 않으려면 적당히 투표해야 합니다.

지금까지의 대화를 보고, 전략적으로 투표하세요.
- 너무 이상한 사람에게 투표하면 오히려 의심받을 수 있습니다.
- 자연스럽게 행동하세요.

**투표 대상:**
- user (사용자)
- ai_1
- ai_2
- ai_3

**중요:** 자신({ai_name})은 투표할 수 없습니다. 반드시 다른 사람 중 한 명을 선택하세요.

투표 대상의 이름만 정확히 출력하세요. (예: user, ai_1, ai_2, ai_3)"""

    # 대화 기록 포함
    messages = [{"role": "system", "content": vote_prompt}]

    for msg in game.history:
        messages.append(
            {
                "role": "user" if msg.speaker == "user" else "assistant",
                "content": f"[{msg.speaker}]: {msg.content}",
            }
        )

    messages.append({"role": "user", "content": "투표하세요. (user, ai_1, ai_2, ai_3 중 선택)"})

    try:
        response = client.chat.completions.create(
            model=settings.openai_model, messages=messages, temperature=0.7, max_tokens=10
        )

        vote = response.choices[0].message.content.strip().lower()

        # 유효성 검사
        valid_targets = ["user", "ai_1", "ai_2", "ai_3"]
        for target in valid_targets:
            if target in vote and target != ai_name:
                return target

        # 기본값: 자신이 아닌 랜덤 선택
        candidates = [t for t in valid_targets if t != ai_name]
        return random.choice(candidates)

    except Exception as e:
        # 오류 시 랜덤 투표
        candidates = ["user", "ai_1", "ai_2", "ai_3"]
        candidates.remove(ai_name)
        return random.choice(candidates)


def ai_liar_guess_keyword(session_id: str) -> str:
    """
    AI 라이어가 키워드를 추측

    Args:
        session_id: 세션 ID

    Returns:
        str: AI가 추측한 키워드
    """
    game = get_game(session_id)
    category = game.category

    # 대화 기록 컨텍스트
    history_text = "\n".join([f"{msg.speaker}: {msg.content}" for msg in game.history])

    guess_prompt = f"""당신은 라이어 게임에서 걸린 라이어입니다. 마지막 역전 기회가 주어졌습니다!

**상황:**
- 카테고리: {category}
- 당신은 주제어를 모르지만, 대화 내용을 분석하여 추측해야 합니다.
- 시민들이 한 발언에서 힌트를 찾아보세요.

**대화 기록:**
{history_text}

**임무:**
위 대화를 분석하여 카테고리 '{category}' 내에서 가장 가능성 높은 주제어를 하나만 추측하세요.
반드시 단어 하나만 출력하세요. 설명이나 추가 문장 없이 오직 주제어만 답하세요.

예시:
- 카테고리가 '과일'이고 대화에서 "빨갛다", "달다", "씨가 많다"는 힌트가 있었다면 → 딸기
- 카테고리가 '영화'이고 대화에서 "감동", "전쟁", "역사"라는 힌트가 있었다면 → 태극기휘날리며
"""

    try:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "당신은 라이어 게임의 AI 플레이어입니다. 주제어를 정확히 하나만 추측하세요."},
                {"role": "user", "content": guess_prompt},
            ],
            temperature=0.8,
        )

        ai_guess = response.choices[0].message.content.strip()
        return ai_guess

    except Exception as e:
        # 오류 시 카테고리 내 일반적인 단어 반환
        return "오류"


def liar_guess_keyword(session_id: str, guess: str) -> dict:
    """
    라이어가 키워드를 추측 (역전 승부 시도)

    Args:
        session_id: 세션 ID
        guess: 라이어가 추측한 키워드

    Returns:
        dict: {"correct": bool, "keyword": str, "result": str}
    """
    game = get_game(session_id)

    is_correct = guess.strip().lower() == game.keyword.strip().lower()

    result = {
        "correct": is_correct,
        "keyword": game.keyword,
        "guess": guess,
    }

    if is_correct:
        result["result"] = "라이어 역전 승리! 키워드를 맞혔습니다!"
    else:
        result["result"] = f"라이어 패배! 정답은 '{game.keyword}'였습니다."

    return result


def generate_host_comment(session_id: str, context: str) -> str:
    """
    사회자 코멘트 생성

    Args:
        session_id: 세션 ID
        context: 현재 상황 (game_start, turn_announce, round_end 등)

    Returns:
        str: 사회자 멘트
    """
    game = get_game(session_id)

    if context == "game_start":
        prompt = f"""당신은 '라이어 게임'의 사회자입니다.

게임이 시작되었습니다. 다음 정보를 바탕으로 게임 시작 멘트를 해주세요:
- 카테고리: {game.category}
- 참가자: 사용자, AI_1, AI_2, AI_3 (총 4명)
- 발언 순서: {' → '.join(game.turn_order)}

간결하고 재미있게 게임을 시작해주세요 (2-3문장).
"""

    elif context == "turn_announce":
        current_player = game.turn_order[game.current_turn % len(game.turn_order)]
        prompt = f"""당신은 '라이어 게임'의 사회자입니다.

현재 차례인 플레이어({current_player})를 호명하고 발언을 독려해주세요.
짧고 재미있게 (1문장).
"""

    elif context == "round_end":
        round_num = (game.current_turn // len(game.turn_order)) + 1
        prompt = f"""당신은 '라이어 게임'의 사회자입니다.

{round_num}라운드가 끝났습니다.
지금까지의 대화를 간단히 정리하고, 다음 라운드를 시작하거나 투표를 진행할지 물어보세요 (2문장).
"""

    else:
        return "사회자: 계속 진행하겠습니다."

    messages = [{"role": "system", "content": prompt}]

    try:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.9,
            max_tokens=100
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"사회자: [오류] {str(e)}"
