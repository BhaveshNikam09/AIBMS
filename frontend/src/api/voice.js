const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TEXT_TIMEOUT_MS = 25000
const AUDIO_TIMEOUT_MS = 45000

const getToken = () => localStorage.getItem('access_token') || ''

function parseApiResponse(raw) {
  return raw?.data || raw
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    const raw = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(raw.message || raw.detail || 'Failed to process voice request')
    }
    return parseApiResponse(raw)
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Voice request timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function sendVoiceAssistantRequest({
  text = '',
  audioBlob = null,
  businessId = null,
  sessionId = null,
  voiceId = null,
  voiceStyle = null,
  voiceModel = null,
  mode = 'command',
} = {}) {
  const token = getToken()
  const url = `${API_BASE}/api/v1/chatbot/voice/`

  if (audioBlob) {
    const form = new FormData()
    form.append('mode', mode)
    if (text) form.append('text', text)
    if (businessId) form.append('business_id', businessId)
    if (sessionId) form.append('session_id', sessionId)
    if (voiceId) form.append('voice_id', voiceId)
    if (voiceStyle) form.append('voice_style', voiceStyle)
    if (voiceModel) form.append('voice_model', voiceModel)
    form.append('audio', audioBlob, 'voice-command.webm')

    return fetchJsonWithTimeout(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    }, AUDIO_TIMEOUT_MS)
  }

  return fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mode,
      text,
      business_id: businessId || null,
      session_id: sessionId || null,
      voice_id: voiceId || null,
      voice_style: voiceStyle || null,
      voice_model: voiceModel || null,
    }),
  }, TEXT_TIMEOUT_MS)
}
