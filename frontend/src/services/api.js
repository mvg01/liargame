import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const gameAPI = {
  // 게임 시작 (keyword가 null이면 랜덤)
  startGame: async (sessionId, keyword = null) => {
    const response = await api.post('/start', {
      session_id: sessionId,
      keyword: keyword,
    });
    return response.data;
  },

  // 대화 진행
  sendMessage: async (sessionId, userMessage) => {
    const response = await api.post('/talk', {
      session_id: sessionId,
      user_message: userMessage,
    });
    return response.data;
  },

  // 투표
  vote: async (sessionId, userVote) => {
    const response = await api.post('/vote', {
      session_id: sessionId,
      user_vote: userVote,
    });
    return response.data;
  },

  // 라이어 역전 승부
  liarGuess: async (sessionId, guess) => {
    const response = await api.post('/liar-guess', {
      session_id: sessionId,
      guess: guess,
    });
    return response.data;
  },

  // 게임 상태 조회
  getStatus: async (sessionId) => {
    const response = await api.get(`/status/${sessionId}`);
    return response.data;
  },
};

export default api;
