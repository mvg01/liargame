import { useState } from 'react'
import GamePage from './components/GamePage'
import './App.css'

function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')

  const handleStartGame = (sid, kw, cat) => {
    setSessionId(sid)
    setKeyword(kw)
    setCategory(cat)
    setGameStarted(true)
  }

  const handleRestart = () => {
    setGameStarted(false)
    setSessionId('')
    setKeyword('')
    setCategory('')
  }

  if (gameStarted) {
    return <GamePage sessionId={sessionId} keyword={keyword} category={category} onRestart={handleRestart} />
  }

  return (
    <div className="app">
      <div className="start-screen">
        <h1 className="title">AI Liar Game</h1>
        <p className="subtitle">사용자 1명 + AI 3명의 심리 추리 게임</p>

        <div className="game-rules">
          <h2>게임 규칙</h2>
          <ul>
            <li>주제어는 랜덤으로 선정됩니다 (카테고리는 공개)</li>
            <li>시민들은 공통 주제어를 알고 있지만, 라이어는 모릅니다</li>
            <li>대화를 통해 라이어를 찾아내세요</li>
            <li>라이어가 걸려도 주제어를 맞히면 역전 승리!</li>
          </ul>
        </div>

        <StartForm onStart={handleStartGame} />
      </div>
    </div>
  )
}

function StartForm({ onStart }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    try {
      const sessionId = `game_${Date.now()}`
      const { gameAPI } = await import('./services/api')
      const response = await gameAPI.startGame(sessionId, null)

      onStart(sessionId, response.keyword, response.category)
    } catch (err) {
      setError(err.response?.data?.detail || '게임 시작 실패. 서버를 확인해주세요.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="start-form">
      <div className="form-group">
        <p className="random-info">🎲 주제어는 랜덤으로 선정됩니다</p>
        <p className="random-description">게임이 시작되면 카테고리만 공개됩니다</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" disabled={loading} className="start-button">
        {loading ? '게임 시작 중...' : '랜덤 게임 시작'}
      </button>
    </form>
  )
}

export default App
