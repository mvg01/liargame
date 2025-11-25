# AI Liar Game - FastAPI Backend

FastAPI와 OpenAI API를 활용한 라이어 게임 백엔드 서버입니다.

## 게임 소개

- **참가자**: 사용자 1명 + AI 3명
- **역할**: 시민(Civilian) vs 라이어(Liar)
- **규칙**:
  - 시민들은 공통 주제어를 알고 있지만, 라이어는 모릅니다
  - 대화를 통해 라이어를 찾아내면 시민 승리
  - 라이어가 끝까지 살아남으면 라이어 승리

## 핵심 기능

1. **독립적인 AI 스레드**: 각 AI는 서로의 역할(라이어 여부)을 모르며, 오직 공개된 대화 내용만 볼 수 있습니다
2. **역할 기반 프롬프트**: 시민과 라이어는 각각 다른 전략으로 행동합니다
3. **공통 대화 기록**: 모든 발언은 공용 히스토리에 저장되어 공유됩니다

## 설치 방법

### 1. 저장소 클론 또는 파일 다운로드

```bash
cd 바이브코딩
```

### 2. 가상 환경 생성 및 활성화

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. 의존성 패키지 설치

```bash
pip install -r requirements.txt
```

### 4. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

`.env` 파일을 열어 OpenAI API 키를 입력합니다:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o
HOST=0.0.0.0
PORT=8000
MAX_HISTORY_LENGTH=20
```

## 서버 실행

```bash
python main.py
```

또는

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 실행되면 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 엔드포인트

### 1. 게임 시작 - `POST /start`

**요청:**
```json
{
  "session_id": "game_001",
  "keyword": "사과"
}
```

**응답:**
```json
{
  "session_id": "game_001",
  "keyword": "사과",
  "liar": "ai_2",
  "message": "게임이 시작되었습니다! 주제어는 '사과'입니다. (라이어: ai_2)"
}
```

### 2. 대화 진행 - `POST /talk`

**요청:**
```json
{
  "session_id": "game_001",
  "user_message": "빨갛고 달콤해요"
}
```

**응답:**
```json
{
  "session_id": "game_001",
  "history": [
    {
      "speaker": "user",
      "content": "빨갛고 달콤해요"
    },
    {
      "speaker": "ai_1",
      "content": "가을에 많이 먹는 과일이죠"
    },
    {
      "speaker": "ai_2",
      "content": "건강에도 좋아요"
    },
    {
      "speaker": "ai_3",
      "content": "껍질째 먹을 수 있어요"
    }
  ],
  "ai_responses": {
    "ai_1": "가을에 많이 먹는 과일이죠",
    "ai_2": "건강에도 좋아요",
    "ai_3": "껍질째 먹을 수 있어요"
  }
}
```

### 3. 투표 및 결과 - `POST /vote`

**요청:**
```json
{
  "session_id": "game_001",
  "user_vote": "ai_2"
}
```

**응답:**
```json
{
  "session_id": "game_001",
  "user_vote": "ai_2",
  "ai_votes": {
    "ai_1": "ai_2",
    "ai_2": "user",
    "ai_3": "ai_2"
  },
  "actual_liar": "ai_2",
  "result": "시민 승리! 라이어를 찾아냈습니다.",
  "vote_counts": {
    "ai_2": 3,
    "user": 1
  }
}
```

### 4. 게임 상태 조회 - `GET /status/{session_id}`

**응답:**
```json
{
  "session_id": "game_001",
  "keyword": "사과",
  "liar": "ai_2",
  "ai_roles": {
    "ai_1": "civilian",
    "ai_2": "liar",
    "ai_3": "civilian"
  },
  "history": [...],
  "total_messages": 4
}
```

## 프로젝트 구조

```
바이브코딩/
├── .env                 # 환경 변수 (API 키 등) - Git에 커밋하지 않음
├── .env.example         # 환경 변수 예시 파일
├── .gitignore           # Git 제외 파일 목록
├── requirements.txt     # Python 의존성 패키지
├── config.py            # 설정 관리 (환경 변수 로드)
├── models.py            # Pydantic 데이터 모델
├── game_logic.py        # 게임 로직 및 AI 응답 생성
├── main.py              # FastAPI 애플리케이션
└── README.md            # 프로젝트 문서
```

## 기술 스택

- **Backend Framework**: FastAPI
- **AI Engine**: OpenAI GPT-4 / GPT-3.5-turbo
- **State Management**: In-Memory Dict (프로토타입용)
- **Environment Management**: python-dotenv
- **Validation**: Pydantic

## 핵심 구현 전략

### 1. 컨텍스트 격리 (Context Isolation)

각 AI는 독립적인 스레드로 동작하며, 오직 다음 정보만 접근 가능합니다:
- 자신의 역할 (시민 or 라이어)
- 공개된 대화 기록 (history)

**구현 위치**: [game_logic.py:104](game_logic.py#L104) - `generate_ai_response` 함수

### 2. 프롬프트 엔지니어링

**시민 프롬프트**:
- 주제어를 너무 노골적으로 설명하지 않음
- 간접적인 힌트 사용
- 이전 대화를 보고 라이어 추리

**라이어 프롬프트**:
- 주제어를 모르지만 아는 척
- 이전 대화에서 카테고리 추측
- 모호하고 일반적인 표현 사용

**구현 위치**: [game_logic.py:52](game_logic.py#L52) - `_build_system_prompt` 함수

### 3. 토큰 비용 최적화

대화 기록이 길어지면 API 비용이 증가하므로, 최근 N개의 메시지만 전송합니다.

설정: `.env` 파일의 `MAX_HISTORY_LENGTH` (기본값: 20)

## 개발 팁

### OpenAI API 키 발급

1. https://platform.openai.com 접속
2. API Keys 메뉴에서 새 키 생성
3. `.env` 파일에 키 입력

### 모델 선택

- `gpt-4o`: 더 정교한 AI 응답 (비용 높음)
- `gpt-3.5-turbo`: 빠르고 저렴함 (성능 보통)

### 배포 시 고려사항

1. **State Management**: Redis나 데이터베이스 사용
2. **CORS 설정**: 특정 도메인으로 제한
3. **환경 변수**: 프로덕션 환경에서는 시스템 환경 변수 사용
4. **Rate Limiting**: API 요청 제한 추가

## 테스트 예시 (curl)

### 게임 시작
```bash
curl -X POST "http://localhost:8000/start" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "keyword": "사과"}'
```

### 대화 진행
```bash
curl -X POST "http://localhost:8000/talk" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "user_message": "빨갛고 달콤해요"}'
```

### 투표
```bash
curl -X POST "http://localhost:8000/vote" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "user_vote": "ai_2"}'
```

## 라이선스

MIT License

## 문의

프로젝트 관련 문의 사항이 있으시면 이슈를 등록해주세요.
