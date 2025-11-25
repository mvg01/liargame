import { useState, useEffect, useRef } from 'react'
import { gameAPI } from '../services/api'
import './GamePage.css'

const GamePage = ({ sessionId, keyword, category, onRestart }) => {
  const [gamePhase, setGamePhase] = useState('talk')
  const [history, setHistory] = useState([])
  const [userMessage, setUserMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voteResult, setVoteResult] = useState(null)
  const [liarGuess, setLiarGuess] = useState('')
  const [finalResult, setFinalResult] = useState(null)
  const [turnOrder, setTurnOrder] = useState([])
  const [nextTurn, setNextTurn] = useState('')
  const [hostComment, setHostComment] = useState('')
  const [roundComplete, setRoundComplete] = useState(false)
  const [actualLiar, setActualLiar] = useState('')
  const [userRole, setUserRole] = useState('')
  const chatEndRef = useRef(null)
  const aiTurnTimeoutRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // 게임 시작 시 초기 데이터 로드
  useEffect(() => {
    const initGame = async () => {
      try {
        const response = await gameAPI.getStatus(sessionId)
        setTurnOrder(response.turn_order || [])
        setNextTurn(response.turn_order ? response.turn_order[0] : 'user')
        setActualLiar(response.liar || '')

        // 사용자 역할 판정
        if (response.liar === 'user') {
          setUserRole('liar')
        } else {
          setUserRole('civilian')
        }
      } catch (err) {
        console.error('게임 초기화 실패:', err)
      }
    }
    initGame()
  }, [sessionId])

  // AI 자동 발언
  useEffect(() => {
    if (gamePhase === 'talk' && nextTurn && nextTurn !== 'user' && !loading && !roundComplete) {
      aiTurnTimeoutRef.current = setTimeout(() => {
        handleAITurn()
      }, 2000)
    }

    return () => {
      if (aiTurnTimeoutRef.current) {
        clearTimeout(aiTurnTimeoutRef.current)
      }
    }
  }, [nextTurn, gamePhase, loading, roundComplete])

  const handleAITurn = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await gameAPI.sendMessage(sessionId, '')
      setHistory(response.history)
      setNextTurn(response.next_turn)
      setHostComment(response.host_comment || '')

      if (response.history.length >= turnOrder.length && response.history.length % turnOrder.length === 0) {
        setRoundComplete(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'AI 발언 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!userMessage.trim() || loading) return

    setLoading(true)
    setError('')

    try {
      const response = await gameAPI.sendMessage(sessionId, userMessage.trim())
      setHistory(response.history)
      setNextTurn(response.next_turn)
      setHostComment(response.host_comment || '')
      setUserMessage('')

      if (response.history.length >= turnOrder.length && response.history.length % turnOrder.length === 0) {
        setRoundComplete(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || '메시지 전송 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleContinueRound = () => {
    setRoundComplete(false)
  }

  const handleVotePhase = () => {
    setGamePhase('vote')
  }

  const handleVote = async (aiName) => {
    setLoading(true)
    setError('')

    try {
      const response = await gameAPI.vote(sessionId, aiName)
      setVoteResult(response)

      if (response.liar_caught) {
        setGamePhase('liar_caught')
      } else {
        setFinalResult(response)
        setGamePhase('result')
      }
    } catch (err) {
      setError(err.response?.data?.detail || '투표 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleLiarGuess = async (e) => {
    e.preventDefault()
    if (!liarGuess.trim() || loading) return

    setLoading(true)
    setError('')

    try {
      const response = await gameAPI.liarGuess(sessionId, liarGuess.trim())
      setFinalResult({
        ...voteResult,
        liar_guess_result: response,
        result: response.result,
      })
      setGamePhase('result')
    } catch (err) {
      setError(err.response?.data?.detail || '역전 승부 실패')
    } finally {
      setLoading(false)
    }
  }

  // 라이어 역전 승부 화면
  if (gamePhase === 'liar_caught' && voteResult) {
    const isUserLiar = voteResult.actual_liar === 'user'

    return (
      <div className="game-page">
        <div className="liar-caught-phase">
          <h1>라이어가 걸렸습니다!</h1>
          <p className="liar-reveal">라이어는 <strong>{getSpeakerName(voteResult.actual_liar)}</strong>입니다</p>

          {isUserLiar ? (
            <div className="last-chance">
              <h2>🎯 당신의 마지막 기회!</h2>
              <p>주제어를 맞히면 역전 승리할 수 있습니다</p>
              <p className="category-hint">카테고리: <strong>{category}</strong></p>

              <form onSubmit={handleLiarGuess} className="guess-form">
                <input
                  type="text"
                  value={liarGuess}
                  onChange={(e) => setLiarGuess(e.target.value)}
                  placeholder="주제어를 입력하세요..."
                  disabled={loading}
                  className="guess-input"
                  autoFocus
                />
                <button type="submit" disabled={loading || !liarGuess.trim()} className="guess-button">
                  {loading ? '제출 중...' : '주제어 제출'}
                </button>
              </form>

              {error && <div className="error-message">{error}</div>}
            </div>
          ) : (
            <div className="last-chance">
              <h2>⏳ 라이어가 주제어를 추측 중...</h2>
              <p>라이어가 주제어를 맞히면 역전 승리합니다!</p>
              <p className="category-hint">카테고리: <strong>{category}</strong></p>
              <div className="waiting-liar">
                <p>잠시만 기다려주세요...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 최종 결과 화면
  if (gamePhase === 'result' && finalResult) {
    return (
      <div className="game-page">
        <div className="game-result">
          <h1 className="result-title">{finalResult.result}</h1>

          {/* 투표 결과 */}
          {finalResult.vote_counts && (
            <div className="result-section vote-summary">
              <h2>📊 투표 결과</h2>
              <div className="vote-counts">
                <p><strong>나의 투표:</strong> {getSpeakerName(finalResult.user_vote)}</p>
                <div className="ai-votes">
                  <p><strong>AI 투표 현황:</strong></p>
                  <ul>
                    {Object.entries(finalResult.ai_votes || {}).map(([ai, vote]) => (
                      <li key={ai}>
                        {getSpeakerName(ai)} → {getSpeakerName(vote)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="vote-count-summary">
                  <p><strong>득표 집계:</strong></p>
                  {Object.entries(finalResult.vote_counts).map(([player, count]) => (
                    <div key={player} className="vote-count-item">
                      <span className="player-name">{getSpeakerName(player)}</span>
                      <span className="vote-badge">{count}표</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {finalResult.liar_guess_result && (
            <div className="result-section liar-guess-section">
              <h2>🎯 역전 승부 결과</h2>
              <p><strong>라이어의 추측:</strong> {finalResult.liar_guess_result.guess}</p>
              <p><strong>정답:</strong> {finalResult.liar_guess_result.keyword}</p>
              <p className={finalResult.liar_guess_result.correct ? 'correct-guess' : 'wrong-guess'}>
                {finalResult.liar_guess_result.correct ? '✅ 정답!' : '❌ 오답!'}
              </p>
            </div>
          )}

          <div className="result-section liar-reveal">
            <h2>🎭 라이어는...</h2>
            <p className="liar-name">{getSpeakerName(finalResult.actual_liar)}</p>
          </div>

          <div className="result-section keyword-reveal">
            <h2>💡 주제어</h2>
            <p className="keyword-name">{keyword}</p>
            <p className="category-name">카테고리: {category}</p>
          </div>

          <button onClick={onRestart} className="restart-button">
            새 게임 시작
          </button>
        </div>
      </div>
    )
  }

  // 투표 화면
  if (gamePhase === 'vote') {
    return (
      <div className="game-page">
        <div className="vote-phase">
          <h1>투표 시간</h1>
          <p className="vote-instruction">누가 라이어라고 생각하시나요?</p>

          <div className="vote-buttons">
            <button onClick={() => handleVote('user')} disabled={loading} className="vote-btn">
              나
            </button>
            <button onClick={() => handleVote('ai_1')} disabled={loading} className="vote-btn">
              AI 1
            </button>
            <button onClick={() => handleVote('ai_2')} disabled={loading} className="vote-btn">
              AI 2
            </button>
            <button onClick={() => handleVote('ai_3')} disabled={loading} className="vote-btn">
              AI 3
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  // 대화 화면
  return (
    <div className="game-page">
      <header className="game-header">
        <h1>🎭 AI Liar Game</h1>
        <div className="game-info">
          <span className="category-badge">카테고리: {category}</span>
          {userRole === 'civilian' && <span className="keyword-badge">주제어: {keyword}</span>}
          {userRole === 'liar' && <span className="liar-badge">⚠️ 당신은 라이어입니다!</span>}
          {userRole === 'civilian' && <span className="civilian-badge">✅ 당신은 시민입니다</span>}
        </div>
      </header>

      {/* 발언 순서 */}
      {turnOrder.length > 0 && (
        <div className="turn-order-display">
          <h3>🎯 발언 순서</h3>
          <div className="turn-order-list">
            {turnOrder.map((player, index) => (
              <div
                key={index}
                className={`turn-item ${player === nextTurn ? 'current-turn' : ''}`}
              >
                <span className="turn-number">{index + 1}</span>
                <span className="turn-player">{getPlayerDisplayName(player)}</span>
                {player === nextTurn && <span className="turn-indicator">👈 현재</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사회자 멘트 */}
      {hostComment && (
        <div className="host-comment">
          <span className="host-icon">🎙️</span>
          <span className="host-text">{hostComment}</span>
        </div>
      )}

      {/* 라운드 완료 */}
      {roundComplete && (
        <div className="round-complete-panel">
          <h3>🔔 라운드 완료!</h3>
          <p>투표를 진행하시겠습니까?</p>
          <div className="round-choice-buttons">
            <button onClick={handleVotePhase} className="vote-now-button">
              투표 시작
            </button>
            <button onClick={handleContinueRound} className="continue-button">
              계속 진행
            </button>
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="chat-messages">
          {history.length === 0 && (
            <div className="empty-state">게임이 곧 시작됩니다...</div>
          )}

          {history.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.speaker === 'user' ? 'user-message' : 'ai-message'}`}
            >
              <div className="message-header">
                <span className="speaker-name">{getSpeakerName(msg.speaker)}</span>
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>

        {/* 사용자 입력 */}
        {nextTurn === 'user' && !roundComplete ? (
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="당신의 차례입니다! 메시지를 입력하세요..."
              disabled={loading}
              className="message-input user-turn-input"
              autoFocus
            />
            <button type="submit" disabled={loading || !userMessage.trim()} className="send-button">
              {loading ? '전송 중...' : '발언하기'}
            </button>
          </form>
        ) : !roundComplete ? (
          <div className="waiting-turn">
            <p>⏳ {getPlayerDisplayName(nextTurn)}의 차례를 기다리는 중...</p>
          </div>
        ) : null}

        {error && <div className="error-message">{error}</div>}
      </div>

      <footer className="game-footer">
        <button onClick={onRestart} className="restart-button-small">
          게임 종료
        </button>
      </footer>
    </div>
  )
}

function getSpeakerName(speaker) {
  const names = {
    user: '나',
    ai_1: 'AI 1',
    ai_2: 'AI 2',
    ai_3: 'AI 3',
    host: '사회자',
  }
  return names[speaker] || speaker
}

function getPlayerDisplayName(player) {
  const names = {
    user: '나',
    ai_1: 'AI 1',
    ai_2: 'AI 2',
    ai_3: 'AI 3',
  }
  return names[player] || player
}

export default GamePage
