import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Loader2, Mic, MicOff, Square, Volume2 } from 'lucide-react'
import { sendVoiceAssistantRequest } from '../../api/voice'
import {
  getSharedChatSessionId,
  setSharedChatSessionId,
  subscribeSharedChatSession,
} from '../utils/chatSession'

const POSITION_KEY = 'voice_assistant_position_v2'
const ENABLED_KEY = 'voice_assistant_enabled'
const BUTTON_WIDTH = 232
const BUTTON_HEIGHT = 82
const RESTART_DELAY_MS = 280
const NETWORK_RETRY_DELAY_MS = 1400
const AUTO_BRIEFING_DELAY_MS = 2200
const RESPONSE_TIMEOUT_MS = 30000

const getBizId = () => localStorage.getItem('business_id') || ''

const getVoiceConfig = () => ({
  voiceId: 'Anisha',
  voiceStyle: 'Conversation',
  voiceModel: 'FALCON',
})

function getUserLabel() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user?.full_name || user?.name || user?.email || 'there'
  } catch {
    return 'there'
  }
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

async function requestMicrophoneAccess() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not supported in this browser.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach(track => track.stop())
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA')
}

function briefingKey() {
  const user = getUserLabel()
  const biz = getBizId() || 'no-business'
  return `voice-briefing:${user}:${biz}:${todayKey()}`
}

function getDefaultPosition() {
  if (typeof window === 'undefined') return { x: 20, y: 600 }
  return { x: 20, y: Math.max(20, window.innerHeight - 104) }
}

function clampPosition(pos) {
  if (typeof window === 'undefined') return pos
  return {
    x: Math.max(12, Math.min(window.innerWidth - BUTTON_WIDTH - 12, pos.x)),
    y: Math.max(12, Math.min(window.innerHeight - BUTTON_HEIGHT - 12, pos.y)),
  }
}

function loadSavedPosition() {
  if (typeof window === 'undefined') return getDefaultPosition()
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (!raw) return getDefaultPosition()
    return clampPosition(JSON.parse(raw))
  } catch {
    return getDefaultPosition()
  }
}

function useDraggable() {
  const [pos, setPos] = useState(loadSavedPosition)
  const posRef = useRef(pos)
  const draggingRef = useRef(false)
  const didDragRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    posRef.current = pos
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos))
    } catch {
      // ignore localStorage issues
    }
  }, [pos])

  useEffect(() => {
    const handleResize = () => setPos(current => clampPosition(current))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return
    draggingRef.current = true
    didDragRef.current = false
    offsetRef.current = {
      x: event.clientX - posRef.current.x,
      y: event.clientY - posRef.current.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event) => {
    if (!draggingRef.current) return
    didDragRef.current = true
    setPos(clampPosition({
      x: event.clientX - offsetRef.current.x,
      y: event.clientY - offsetRef.current.y,
    }))
  }, [])

  const onPointerUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  return {
    pos,
    didDragRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}

export function VoiceBuddyFloating() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(ENABLED_KEY)
    return stored == null ? true : stored === 'true'
  })
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState('Tap once to talk')
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [sessionId, setSessionId] = useState(() => getSharedChatSessionId() || '')
  const [useFallbackRecorder, setUseFallbackRecorder] = useState(true)

  const { pos, didDragRef, onPointerDown, onPointerMove, onPointerUp } = useDraggable()

  const recognitionRef = useRef(null)
  const recorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null)
  const restartTimerRef = useRef(null)
  const briefingTimerRef = useRef(null)
  const busyTimerRef = useRef(null)
  const interactionRef = useRef(false)
  const autoBriefingDoneRef = useRef(false)
  const networkFailCountRef = useRef(0)
  const micPrimedRef = useRef(false)
  const submitVoiceTextRef = useRef(null)

  const enabledRef = useRef(enabled)
  const listeningRef = useRef(listening)
  const recordingRef = useRef(recording)
  const speakingRef = useRef(speaking)
  const busyRef = useRef(busy)
  const sessionRef = useRef(sessionId)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { listeningRef.current = listening }, [listening])
  useEffect(() => { recordingRef.current = recording }, [recording])
  useEffect(() => { speakingRef.current = speaking }, [speaking])
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => { sessionRef.current = sessionId }, [sessionId])

  useEffect(() => subscribeSharedChatSession(next => setSessionId(next || '')), [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
  }, [])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const clearBriefingTimer = useCallback(() => {
    if (briefingTimerRef.current) {
      clearTimeout(briefingTimerRef.current)
      briefingTimerRef.current = null
    }
  }, [])

  const clearBusyTimer = useCallback(() => {
    if (busyTimerRef.current) {
      clearTimeout(busyTimerRef.current)
      busyTimerRef.current = null
    }
  }, [])

  const stopSpeechPlayback = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore audio pause issues
      }
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore TTS cancel issues
      }
    }
    speakingRef.current = false
    setSpeaking(false)
  }, [])

  const stopRecognition = useCallback(() => {
    clearRestartTimer()
    const recognition = recognitionRef.current
    if (recognition) {
      try {
        recognition.abort()
      } catch {
        // ignore abort failures
      }
      recognitionRef.current = null
    }
    listeningRef.current = false
    setListening(false)
  }, [clearRestartTimer])

  const stopMediaRecorder = useCallback(() => {
    recorderRef.current = null
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    chunksRef.current = []
    recordingRef.current = false
    setRecording(false)
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop()
      } catch {
        // ignore stop issues
      }
    }
  }, [])

  const stopAll = useCallback(() => {
    stopRecognition()
    stopMediaRecorder()
  }, [stopMediaRecorder, stopRecognition])

  const scheduleListeningRestart = useCallback((resumeFn, delay = RESTART_DELAY_MS) => {
    clearRestartTimer()
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      resumeFn()
    }, delay)
  }, [clearRestartTimer])

  const resumePassiveListening = useCallback(() => {
    if (!enabledRef.current || useFallbackRecorder || busyRef.current || speakingRef.current || recordingRef.current) {
      return
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setUseFallbackRecorder(true)
      setStatusText('Tap once to talk')
      return
    }

    if (recognitionRef.current) return

    const recognition = new Ctor()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      networkFailCountRef.current = 0
      listeningRef.current = true
      setListening(true)
      setError('')
      setStatusText('Listening for your command')
    }

    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal && result[0]?.transcript) {
          finalText += `${result[0].transcript} `
        }
      }

      const cleaned = finalText.trim()
      if (cleaned) {
        interactionRef.current = true
        void submitVoiceTextRef.current?.(cleaned, 'command')
      }
    }

    recognition.onerror = (event) => {
      const err = event.error
      listeningRef.current = false
      setListening(false)
      recognitionRef.current = null

      if (err === 'aborted') return

      if (err === 'no-speech') {
        if (enabledRef.current && !busyRef.current && !speakingRef.current) {
          scheduleListeningRestart(resumePassiveListening)
        }
        return
      }

      if (err === 'network') {
        networkFailCountRef.current += 1
        if (networkFailCountRef.current >= 2) {
          setUseFallbackRecorder(true)
          setStatusText('Tap once to talk')
          setError('')
          return
        }
        scheduleListeningRestart(resumePassiveListening, NETWORK_RETRY_DELAY_MS)
        return
      }

      setError(`Mic error: ${err}`)
      setStatusText('Microphone unavailable')
    }

    recognition.onend = () => {
      listeningRef.current = false
      setListening(false)
      recognitionRef.current = null
      if (enabledRef.current && !busyRef.current && !speakingRef.current && !useFallbackRecorder) {
        scheduleListeningRestart(resumePassiveListening)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      listeningRef.current = false
      setListening(false)
      setUseFallbackRecorder(true)
      setStatusText('Tap once to talk')
    }
  }, [scheduleListeningRestart, useFallbackRecorder])

  const speakViaBrowser = useCallback((text) => {
    const finish = () => {
      speakingRef.current = false
      setSpeaking(false)
      if (enabledRef.current) {
        setStatusText(useFallbackRecorder ? 'Tap once to talk' : 'Say "Hey buddy"')
        scheduleListeningRestart(resumePassiveListening, 220)
      } else {
        setStatusText('Voice off')
      }
    }

    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      finish()
      return
    }

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-IN'
      utterance.rate = 1.02
      utterance.pitch = 1

      const voices = window.speechSynthesis.getVoices()
      const preferredVoice =
        voices.find(voice => voice.lang === 'en-IN' && /female/i.test(voice.name))
        || voices.find(voice => voice.lang === 'en-IN')
        || voices.find(voice => voice.lang.startsWith('en'))

      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      const ttsTimeout = setTimeout(() => {
        if (!speakingRef.current) {
          finish()
        }
      }, 1800)

      utterance.onstart = () => {
        clearTimeout(ttsTimeout)
        speakingRef.current = true
        setSpeaking(true)
        setStatusText('Speaking')
      }
      utterance.onend = finish
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    } catch {
      finish()
    }
  }, [resumePassiveListening, scheduleListeningRestart, useFallbackRecorder])

  const playAssistantAudio = useCallback((audioUrl, fallbackText) => {
    stopAll()

    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.preload = 'auto'
      audioRef.current = audio
      speakingRef.current = true
      setSpeaking(true)
      setStatusText('Speaking')

      const finish = () => {
        audioRef.current = null
        speakingRef.current = false
        setSpeaking(false)
        if (enabledRef.current) {
          setStatusText(useFallbackRecorder ? 'Tap once to talk' : 'Say "Hey buddy"')
          scheduleListeningRestart(resumePassiveListening, 220)
        } else {
          setStatusText('Voice off')
        }
      }

      audio.onended = finish
      audio.onerror = () => {
        audioRef.current = null
        speakingRef.current = false
        setSpeaking(false)
        speakViaBrowser(fallbackText)
      }
      audio.play().catch(() => {
        audioRef.current = null
        speakingRef.current = false
        setSpeaking(false)
        speakViaBrowser(fallbackText)
      })
      return
    }

    speakViaBrowser(fallbackText)
  }, [resumePassiveListening, scheduleListeningRestart, speakViaBrowser, stopAll, useFallbackRecorder])

  const startBusySafeguard = useCallback(() => {
    clearBusyTimer()
    busyTimerRef.current = setTimeout(() => {
      if (!busyRef.current) return
      busyRef.current = false
      setBusy(false)
      setStatusText('Ready')
      scheduleListeningRestart(resumePassiveListening)
    }, RESPONSE_TIMEOUT_MS)
  }, [clearBusyTimer, resumePassiveListening, scheduleListeningRestart])

  const submitVoiceText = useCallback(async (commandText, mode = 'command') => {
    const text = String(commandText || '').trim()
    if (!text || busyRef.current) return false

    interactionRef.current = true
    setError('')
    setTranscript(text)
    setResponse('')
    busyRef.current = true
    setBusy(true)
    setStatusText(mode === 'briefing' ? 'Preparing briefing' : 'Thinking')
    stopAll()
    startBusySafeguard()

    try {
      const data = await sendVoiceAssistantRequest({
        text,
        businessId: getBizId() || null,
        sessionId: sessionRef.current || null,
        ...getVoiceConfig(),
        mode,
      })

      if (data?.session_id) {
        setSessionId(data.session_id)
        setSharedChatSessionId(data.session_id)
      }

      const spokenText = data?.speech_text || data?.response_text || data?.response || ''
      const displayText = data?.response_text || data?.response || spokenText
      setTranscript(data?.transcript || text)
      setResponse(displayText)
      setStatusText(data?.voice_mode === 'briefing' ? 'Briefing ready' : 'Response ready')
      playAssistantAudio(data?.audio_url || '', spokenText || displayText)
      return true
    } catch (err) {
      setError(err?.message || 'Voice request failed')
      setStatusText('Voice error')
      scheduleListeningRestart(resumePassiveListening, 320)
      return false
    } finally {
      clearBusyTimer()
      busyRef.current = false
      setBusy(false)
    }
  }, [clearBusyTimer, playAssistantAudio, resumePassiveListening, scheduleListeningRestart, startBusySafeguard, stopAll])

  useEffect(() => {
    submitVoiceTextRef.current = submitVoiceText
  }, [submitVoiceText])

  const submitAudioBlob = useCallback(async (blob) => {
    if (!blob || blob.size === 0 || busyRef.current) return false

    interactionRef.current = true
    setError('')
    setTranscript('Processing audio')
    setResponse('')
    busyRef.current = true
    setBusy(true)
    setStatusText('Uploading audio')
    startBusySafeguard()

    try {
      const data = await sendVoiceAssistantRequest({
        audioBlob: blob,
        businessId: getBizId() || null,
        sessionId: sessionRef.current || null,
        ...getVoiceConfig(),
        mode: 'command',
      })

      if (data?.session_id) {
        setSessionId(data.session_id)
        setSharedChatSessionId(data.session_id)
      }

      const spokenText = data?.speech_text || data?.response_text || data?.response || ''
      const displayText = data?.response_text || data?.response || spokenText
      setTranscript(data?.transcript || 'Voice command')
      setResponse(displayText)
      setStatusText('Response ready')
      playAssistantAudio(data?.audio_url || '', spokenText || displayText)
      return true
    } catch (err) {
      setError(err?.message || 'Audio processing failed')
      setStatusText('Voice error')
      scheduleListeningRestart(resumePassiveListening, 320)
      return false
    } finally {
      clearBusyTimer()
      busyRef.current = false
      setBusy(false)
    }
  }, [clearBusyTimer, playAssistantAudio, resumePassiveListening, scheduleListeningRestart, startBusySafeguard])

  const startRecording = useCallback(async () => {
    if (busyRef.current || speakingRef.current || recordingRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stopMediaRecorder()
        if (blob.size > 0) {
          void submitAudioBlob(blob)
        } else if (enabledRef.current) {
          scheduleListeningRestart(resumePassiveListening, 320)
        }
      }

      recorder.start()
      recordingRef.current = true
      setRecording(true)
      setError('')
      setStatusText('Recording - tap again to send')
    } catch (err) {
      setError(err?.message || 'Microphone permission denied')
      setStatusText('Microphone permission needed')
    }
  }, [resumePassiveListening, scheduleListeningRestart, stopMediaRecorder, submitAudioBlob])

  const activateVoiceAssistant = useCallback(async () => {
    interactionRef.current = true
    setError('')
    enabledRef.current = true
    setEnabled(true)

    if (useFallbackRecorder || !getSpeechRecognitionCtor()) {
      setUseFallbackRecorder(true)
      await startRecording()
      return
    }

    try {
      if (!micPrimedRef.current) {
        await requestMicrophoneAccess()
        micPrimedRef.current = true
      }
      setStatusText('Listening for your command')
      stopAll()
      resumePassiveListening()
    } catch (err) {
      setError(err?.message || 'Microphone permission denied')
      setStatusText('Tap to retry microphone')
    }
  }, [resumePassiveListening, startRecording, stopAll, useFallbackRecorder])

  const disableAssistant = useCallback(() => {
    interactionRef.current = true
    enabledRef.current = false
    setEnabled(false)
    clearBriefingTimer()
    clearBusyTimer()
    stopAll()
    stopSpeechPlayback()
    setStatusText('Voice off')
  }, [clearBriefingTimer, clearBusyTimer, stopAll, stopSpeechPlayback])

  const toggleLiveMode = useCallback((e) => {
    e.stopPropagation()
    if (enabledRef.current) {
      disableAssistant()
    } else {
      activateVoiceAssistant()
    }
  }, [activateVoiceAssistant, disableAssistant])

  const maybeSendLoginBriefing = useCallback(async () => {
    const bizId = getBizId()
    if (!bizId || autoBriefingDoneRef.current || busyRef.current || speakingRef.current || recordingRef.current) {
      return
    }

    const key = briefingKey()
    if (localStorage.getItem(key) === '1') {
      autoBriefingDoneRef.current = true
      return
    }

    const succeeded = await submitVoiceText('hey buddy', 'briefing')
    autoBriefingDoneRef.current = true
    if (succeeded) {
      localStorage.setItem(key, '1')
    }
  }, [submitVoiceText])

  const handleAssistantToggle = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    if (recordingRef.current) {
      stopRecording()
      return
    }

    if (speakingRef.current) {
      stopSpeechPlayback()
      scheduleListeningRestart(resumePassiveListening, 220)
      return
    }

    if (busyRef.current) return

    // Clicking always triggers manual recording now
    // If the assistant was "off", we don't necessarily turn wake-word listening on,
    // but we allow manual interaction.
    void startRecording()
  }, [
    didDragRef,
    resumePassiveListening,
    scheduleListeningRestart,
    startRecording,
    stopRecording,
    stopSpeechPlayback,
  ])

  useEffect(() => {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')

    if (!enabled) {
      clearBriefingTimer()
      stopAll()
      setStatusText('Voice off')
      return
    }

    setStatusText(useFallbackRecorder ? 'Tap once to talk' : 'Say "Hey buddy"')
    if (!useFallbackRecorder) {
      scheduleListeningRestart(resumePassiveListening, 160)
    }

  }, [
    clearBriefingTimer,
    enabled,
    maybeSendLoginBriefing,
    resumePassiveListening,
    scheduleListeningRestart,
    stopAll,
    useFallbackRecorder,
  ])

  useEffect(() => {
    return () => {
      clearRestartTimer()
      clearBriefingTimer()
      clearBusyTimer()
      stopAll()
      stopSpeechPlayback()
    }
  }, [clearBriefingTimer, clearBusyTimer, clearRestartTimer, stopAll, stopSpeechPlayback])

  const statusLabel = useMemo(() => {
    if (error) return 'Needs attention'
    if (busy) return 'Thinking'
    if (speaking) return 'Speaking'
    if (recording) return 'Recording'
    if (listening) return 'Listening'
    if (!enabled) return 'Off'
    return useFallbackRecorder ? 'Tap to talk' : 'Ready'
  }, [busy, enabled, error, listening, recording, speaking, useFallbackRecorder])

  const indicatorClass = error
    ? 'bg-rose-500'
    : recording || listening
      ? 'bg-red-500 animate-pulse'
      : speaking
        ? 'bg-sky-400 animate-pulse'
        : enabled
          ? 'bg-emerald-400'
          : 'bg-slate-500'

  const icon = busy
    ? <Loader2 size={18} className="animate-spin" />
    : recording
      ? <Square size={18} className="fill-white" />
      : enabled
        ? <Mic size={18} />
        : <MicOff size={18} />

  const title = [
    error ? `Error: ${error}` : '',
    transcript ? `Last heard: ${transcript}` : '',
    response ? `Last reply: ${response}` : '',
  ].filter(Boolean).join('\n')

  return (
    <button
      type="button"
      title={title}
      aria-label={`Jarvis voice assistant: ${statusLabel}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={handleAssistantToggle}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        width: BUTTON_WIDTH,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      className={`rounded-[26px] border px-4 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition-all ${
        enabled
          ? 'border-slate-800 bg-[linear-gradient(135deg,#020617_0%,#0f172a_58%,#172554_100%)] text-white hover:translate-y-[-1px] hover:shadow-[0_22px_48px_rgba(15,23,42,0.26)]'
          : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          enabled ? 'bg-blue-600/95 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.15)]' : 'bg-slate-200 text-slate-600'
        }`}>
          {speaking ? <Volume2 size={18} /> : icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Bot size={13} className={enabled ? 'text-blue-300' : 'text-slate-500'} />
            <span className="text-sm font-semibold">Jarvis Voice</span>
            <button
              onClick={toggleLiveMode}
              className={`ml-auto flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all ${
                enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
              }`}
            >
              <span className={`h-1 w-1 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {enabled ? 'On' : 'Off'}
            </button>
          </div>
          <p className={`mt-1 text-xs font-medium ${enabled ? 'text-slate-100' : 'text-slate-500'}`}>
            {statusLabel}
          </p>
          <p className={`mt-1 line-clamp-2 text-[11px] ${error ? 'text-rose-200' : enabled ? 'text-slate-300' : 'text-slate-400'}`}>
            {error || statusText}
          </p>
          <p className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${enabled ? 'text-slate-500' : 'text-slate-400'}`}>
            {useFallbackRecorder ? 'Tap once to record' : 'Say hey buddy'}
          </p>
        </div>
      </div>
    </button>
  )
}
