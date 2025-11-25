# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Liar Game - FastAPI backend server where 1 user plays with 3 AI agents in a social deduction game. AIs are assigned either "Civilian" (knows keyword) or "Liar" (doesn't know keyword) roles and must participate in conversation without revealing their identity.

## Environment Setup

Required `.env` file (copy from `.env.example`):
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o  # or gpt-3.5-turbo
MAX_HISTORY_LENGTH=20
```

Installation:
```bash
pip install -r requirements.txt
```

## Running the Server

```bash
# Development mode (auto-reload)
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API documentation available at:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc

## Architecture

### Core Data Flow

1. **Game Creation** (`/start`): Creates new game session with random liar assignment
2. **Conversation** (`/talk`): User message → AI 1 responds → AI 2 responds → AI 3 responds
3. **Voting** (`/vote`): Collect votes from user and all AIs → determine winner

### Critical Design: AI Context Isolation

**Implementation in `game_logic.py:generate_ai_response()`**

Each AI operates in complete isolation:
- Receives ONLY: their own role (civilian/liar) + shared conversation history
- Does NOT receive: other AIs' roles or internal states
- Context is recreated fresh for each AI on every turn

This is achieved by:
```python
# New messages list for each AI
messages = [{"role": "system", "content": system_prompt}]  # Unique per AI
for msg in recent_history:  # Shared history only
    messages.append(...)
```

Each AI gets a different system prompt based on their secret role via `_build_system_prompt()`.

### State Management

**Location**: `game_logic.py:game_sessions` (line 18)

- In-memory dictionary: `Dict[str, GameState]`
- Session-based: Multiple games can run simultaneously with unique `session_id`
- **Production consideration**: Replace with Redis or database for persistence

### Prompt Engineering Strategy

**Location**: `game_logic.py:_build_system_prompt()` (line 62)

Two distinct prompt strategies:
- **Civilian**: Knows keyword, must give subtle hints without revealing it directly
- **Liar**: Doesn't know keyword, must infer from context and blend in

Prompt quality is critical - AIs must be instructed to:
- Civilians: Use indirect hints, avoid explicit descriptions
- Liars: Observe carefully, stay vague, never admit ignorance

### Token Cost Optimization

Conversation history is truncated to recent N messages before OpenAI API calls:
```python
recent_history = game.history[-settings.max_history_length:]
```

Controlled by `MAX_HISTORY_LENGTH` environment variable (default: 20).

## Module Structure

- `main.py`: FastAPI endpoints and request/response handling
- `game_logic.py`: Core game logic, OpenAI API integration, AI response generation
- `models.py`: Pydantic models for requests, responses, and game state
- `config.py`: Environment variable loading via pydantic-settings

## Testing APIs

```bash
# Start game
curl -X POST "http://localhost:8000/start" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "keyword": "사과"}'

# Send user message and get AI responses
curl -X POST "http://localhost:8000/talk" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "user_message": "빨갛고 달콤해요"}'

# Vote and get results
curl -X POST "http://localhost:8000/vote" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_001", "user_vote": "ai_2"}'

# Check game state (debug)
curl "http://localhost:8000/status/test_001"
```

## Modifying AI Behavior

When adjusting how AIs play the game:

1. **Prompt changes**: Edit `_build_system_prompt()` in `game_logic.py`
2. **Response parameters**: Modify OpenAI API calls in `generate_ai_response()` and `ai_vote()`
   - `temperature`: Controls randomness (0.7-0.8 currently)
   - `max_tokens`: Limits response length (150 for talk, 10 for vote)
3. **Voting logic**: Adjust vote validation in `ai_vote()` function

## Production Deployment Considerations

- Replace `game_sessions` dict with Redis/database
- Set CORS `allow_origins` to specific domains (currently allows all)
- Use system environment variables instead of `.env` file
- Add rate limiting middleware
- Consider implementing session cleanup/expiration
