# AI Liar Game - Frontend

React + Vite로 제작된 AI 라이어 게임 프론트엔드입니다.

## 설치 및 실행

### 1. 의존성 설치

```bash
cd frontend
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 3. 백엔드 서버 실행 (필수)

프론트엔드를 실행하기 전에 FastAPI 백엔드 서버가 실행 중이어야 합니다.

```bash
# 프로젝트 루트 디렉토리에서
python main.py
```

백엔드 서버: http://localhost:8000

## 게임 플레이 방법

1. **게임 시작**: 주제어 입력 후 "게임 시작" 클릭
2. **대화 진행**: 메시지를 입력하면 AI 3명이 순차적으로 응답
3. **투표**: 충분히 대화한 후 "투표하기" 버튼 클릭
4. **결과 확인**: 누가 라이어인지, 투표 결과 확인

## 프로젝트 구조

```
frontend/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx              # 엔트리 포인트
    ├── App.jsx               # 메인 컴포넌트 (시작 화면)
    ├── App.css               # 시작 화면 스타일
    ├── index.css             # 글로벌 스타일
    ├── components/
    │   ├── GamePage.jsx      # 게임 진행 페이지
    │   └── GamePage.css      # 게임 페이지 스타일
    └── services/
        └── api.js            # API 통신 유틸리티
```

## 주요 기능

- Vite Proxy를 통한 백엔드 API 연동
- 실시간 채팅 인터페이스
- 3단계 게임 플로우 (대화 → 투표 → 결과)
- 반응형 디자인
- 자동 스크롤 (새 메시지 발생 시)

## API 엔드포인트

프론트엔드는 다음 백엔드 API를 사용합니다:

- `POST /api/start` - 게임 시작
- `POST /api/talk` - 대화 진행
- `POST /api/vote` - 투표 및 결과
- `GET /api/status/{session_id}` - 게임 상태 조회

## 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다.

## 프리뷰 (빌드 결과 확인)

```bash
npm run preview
```
