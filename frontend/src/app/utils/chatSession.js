const SESSION_KEY = 'ai_chatbot_session_id'
const SESSION_EVENT = 'ai-chat-session-changed'

export function getSharedChatSessionId() {
  return localStorage.getItem(SESSION_KEY) || ''
}

export function setSharedChatSessionId(sessionId) {
  const value = sessionId ? String(sessionId) : ''
  if (value) {
    localStorage.setItem(SESSION_KEY, value)
  } else {
    localStorage.removeItem(SESSION_KEY)
  }

  window.dispatchEvent(
    new CustomEvent(SESSION_EVENT, { detail: { sessionId: value } })
  )
}

export function clearSharedChatSessionId() {
  setSharedChatSessionId('')
}

export function subscribeSharedChatSession(handler) {
  const wrapped = event => handler(event.detail?.sessionId || '')
  window.addEventListener(SESSION_EVENT, wrapped)
  return () => window.removeEventListener(SESSION_EVENT, wrapped)
}
