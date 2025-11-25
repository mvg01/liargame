import { useState, useEffect, useRef } from 'react'
import { gameAPI } from '../services/api'
import './GamePage.css'

const GamePage = ({ sessionId, keyword, category, onRestart }) => {
  const [gamePhase, setGamePhase] = useState('talk') // 'talk' or 'vote' or 'liar_caught' or 'result'
  const [history, setHistory] = useState([])
  const [userMessage, setUserMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voteResult, setVoteResult] = useState(null)
  const [liarGuess, setLiarGuess] = useState('')
  const [finalResult, setFinalResult] = useState(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!userMessage.trim() || loading) return

    setLoading(true)
    setError('')

    try {
      const response = await gameAPI.sendMessage(sessionId, userMessage.trim())

      setHistory(response.history)
      setUserMessage('')
    } catch (err) {
      setError(err.response?.data?.detail || '메시지 전송 실패')
    } finally {
      setLoading(false)
    }
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

      // 라이어가 걸렸으면 역전 승부 단계로
      if (response.liar_caught) {
        setGamePhase('liar_caught')
      } else {
        // 라이어가 안 걸렸으면 바로 결과
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

      // 역전 승부 결과를 포함한 최종 결과 설정
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
    return (
      <div className="game-page">
        <div className="liar-caught-phase">
          <h1>라이어가 걸렸습니다!</h1>
          <p className="liar-reveal">라이어는 <strong>{voteResult.actual_liar}</strong>입니다</p>

          <div className="last-chance">
            <h2>🎯 라이어의 마지막 기회!</h2>
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
              />
              <button type="submit" disabled={loading || !liarGuess.trim()} className="guess-button">
                {loading ? '제출 중...' : '주제어 제출'}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="vote-summary-small">
            <h3>투표 결과</h3>
            {Object.entries(voteResult.vote_counts).map(([player, count]) => (
              <div key={player} className="vote-item">
                {player}: {count}표
              </div>
            ))}
          </div>
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

          {finalResult.liar_guess_result && (
            <div className="result-section liar-guess-section">
              <h2>역전 승부 결과</h2>
              <p><strong>라이어의 추측:</strong> {finalResult.liar_guess_result.guess}</p>
              <p><strong>정답:</strong> {finalResult.liar_guess_result.keyword}</p>
              <p className={finalResult.liar_guess_result.correct ? 'correct-guess' : 'wrong-guess'}>
                {finalResult.liar_guess_result.correct ? '✅ 정답!' : '❌ 오답!'}
              </p>
            </div>
          )}

          <div className="result-section">
            <h2>투표 결과</h2>
            <div className="vote-summary">
              <p>
                <strong>당신의 투표:</strong> {finalResult.user_vote}
              </p>
              <p>
                <strong>AI 투표:</strong>
              </p>
              <ul>
                <li>AI 1: {finalResult.ai_votes.ai_1}</li>
                <li>AI 2: {finalResult.ai_votes.ai_2}</li>
                <li>AI 3: {finalResult.ai_votes.ai_3}</li>
              </ul>
            </div>
          </div>

          <div className="result-section">
            <h2>득표 결과</h2>
            <div className="vote-counts">
              {Object.entries(finalResult.vote_counts).map(([player, count]) => (
                <div key={player} className="vote-count-item">
                  <span className="player-name">{player}</span>
                  <span className="vote-badge">{count}표</span>
                </div>
              ))}
            </div>
          </div>

          <div className="result-section liar-reveal">
            <h2>라이어는...</h2>
            <p className="liar-name">{finalResult.actual_liar}</p>
          </div>

          <div className="result-section keyword-reveal">
            <h2>주제어</h2>
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
        <h1>AI Liar Game</h1>
        <div className="game-info">
          <span className="category-badge">카테고리: {category}</span>
          <span className="keyword-badge">주제어: {keyword}</span>
          <span className="session-badge">세션: {sessionId}</span>
        </div>
      </header>

      <div className="chat-container">
        <div className="chat-messages">
          {history.length === 0 && (
            <div className="empty-state">대화를 시작해보세요!</div>
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

        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
            className="message-input"
          />
          <button type="submit" disabled={loading || !userMessage.trim()} className="send-button">
            {loading ? '전송 중...' : '전송'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>

      <footer className="game-footer">
        <button onClick={handleVotePhase} className="vote-button" disabled={history.length === 0}>
          투표하기
        </button>
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
  }
  return names[speaker] || speaker
}

export default GamePage
