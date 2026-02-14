import { useState, useRef, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Avatar from './components/Avatar'
import VictorianEnvironment from './components/VictorianEnvironment'
import { getInteractiveResponse, getPredefinedResponse } from './utils/interactive'
import { LipSyncProvider, useLipSyncContext } from './contexts/LipSyncContext'
import { generateSpeechWithElevenLabs, speechToTextWithElevenLabs } from './utils/elevenlabs'
import { saveAudioFile, sanitizeFilename } from './utils/audioSaver'
import { createAudioAnalyser } from './utils/audioAnalyser'
import './App.css'

// Conversation states
const STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
}

function AppContent() {
  const [convState, setConvState] = useState(STATE.IDLE)
  const [error, setError] = useState(null)
  const [answerText, setAnswerText] = useState(null)
  const [conversationHistory, setConversationHistory] = useState([])
  const [sceneReady, setSceneReady] = useState(false)
  const [textInput, setTextInput] = useState('')

  const { setAudioElement, setLipSyncData, setIsProcessing, setAnimationType, setGetAmplitude, setCurrentEmotion, setConvState: setContextConvState } = useLipSyncContext()
  const analyserRef = useRef(null)

  // VAD refs
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const vadAnalyserRef = useRef(null)
  const vadContextRef = useRef(null)
  const vadIntervalRef = useRef(null)
  const silenceStartRef = useRef(null)
  const isSpeakingRef = useRef(false)
  const convStateRef = useRef(STATE.IDLE)
  const audioElementRef = useRef(null)

  // Keep ref in sync with state, and sync to context for Avatar
  useEffect(() => {
    convStateRef.current = convState
    setContextConvState(convState)
  }, [convState])

  // Parse emotion tag from response text: "[happy] Hello!" -> { emotion: "happy", text: "Hello!" }
  function parseEmotionTag(text) {
    const match = text.match(/^\[(happy|thoughtful|sad|excited|surprised|amused)\]\s*/i)
    if (match) {
      return { emotion: match[1].toLowerCase(), text: text.slice(match[0].length) }
    }
    return { emotion: 'neutral', text }
  }

  // Mark scene as ready after a brief delay for GLB loading
  useEffect(() => {
    const timer = setTimeout(() => setSceneReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  // Check file server
  useEffect(() => {
    fetch('http://localhost:3001/api/health').catch(() => {
      console.warn('File server not running. Start with: npm run dev:full')
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVAD()
    }
  }, [])

  // === VAD: Voice Activity Detection using Web Audio API ===

  const SILENCE_THRESHOLD = 15 // Volume level (0-255) below which is "silence"
  const SILENCE_DURATION = 1500 // ms of silence before stopping recording
  const VAD_CHECK_INTERVAL = 100 // ms between VAD checks

  function startVAD(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    vadContextRef.current = audioContext
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.5
    source.connect(analyser)
    vadAnalyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    silenceStartRef.current = null
    isSpeakingRef.current = false

    vadIntervalRef.current = setInterval(() => {
      if (convStateRef.current !== STATE.LISTENING) return

      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      const avgVolume = sum / dataArray.length

      if (avgVolume > SILENCE_THRESHOLD) {
        // User is speaking
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true
          startRecording(stream)
        }
        silenceStartRef.current = null
      } else if (isSpeakingRef.current) {
        // User was speaking, now silent
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now()
        } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
          // Silence long enough — stop recording
          isSpeakingRef.current = false
          silenceStartRef.current = null
          stopRecording()
        }
      }
    }, VAD_CHECK_INTERVAL)
  }

  function stopVAD() {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }
    if (vadContextRef.current) {
      vadContextRef.current.close().catch(() => {})
      vadContextRef.current = null
    }
    vadAnalyserRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
  }

  function startRecording(stream) {
    audioChunksRef.current = []
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      if (audioBlob.size < 1000) {
        // Too short, go back to listening
        setConvState(STATE.LISTENING)
        return
      }
      await processUserAudio(audioBlob)
    }

    mediaRecorder.start()
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  // === Convert WebM to WAV ===
  async function convertWebMToWav(webmBlob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const arrayBuffer = await webmBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const wav = audioBufferToWav(audioBuffer)
    audioContext.close()
    return new Blob([wav], { type: 'audio/wav' })
  }

  function audioBufferToWav(buffer) {
    const length = buffer.length
    const sampleRate = buffer.sampleRate
    const channels = buffer.numberOfChannels
    const arrayBuffer = new ArrayBuffer(44 + length * channels * 2)
    const view = new DataView(arrayBuffer)
    let offset = 0

    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
      offset += str.length
    }

    writeString('RIFF')
    view.setUint32(offset, 36 + length * channels * 2, true); offset += 4
    writeString('WAVE')
    writeString('fmt ')
    view.setUint32(offset, 16, true); offset += 4
    view.setUint16(offset, 1, true); offset += 2
    view.setUint16(offset, channels, true); offset += 2
    view.setUint32(offset, sampleRate, true); offset += 4
    view.setUint32(offset, sampleRate * channels * 2, true); offset += 4
    view.setUint16(offset, channels * 2, true); offset += 2
    view.setUint16(offset, 16, true); offset += 2
    writeString('data')
    view.setUint32(offset, length * channels * 2, true); offset += 4

    for (let channel = 0; channel < channels; channel++) {
      const channelData = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }
    return arrayBuffer
  }

  // === Process user audio: STT -> Groq -> TTS -> play ===
  async function processUserAudio(webmBlob) {
    setConvState(STATE.THINKING)
    setError(null)

    try {
      // STT
      const wavBlob = await convertWebMToWav(webmBlob)
      const transcribedText = await speechToTextWithElevenLabs(wavBlob, {
        modelId: 'scribe_v1',
        languageCode: 'en',
        diarize: false
      })

      if (!transcribedText || !transcribedText.trim()) {
        setConvState(STATE.LISTENING)
        return
      }

      console.log('[VAD] User said:', transcribedText)

      // Get response (predefined or Groq)
      const predefined = getPredefinedResponse(transcribedText)
      let responseText

      if (predefined) {
        responseText = predefined
      } else {
        const limitedHistory = conversationHistory.slice(-20)
        responseText = await getInteractiveResponse(transcribedText, limitedHistory)
      }

      // Update conversation history
      setConversationHistory(prev => {
        const updated = [
          ...prev,
          { role: 'user', content: transcribedText },
          { role: 'assistant', content: responseText }
        ]
        return updated.slice(-20)
      })

      if (!responseText || !responseText.trim()) {
        responseText = "[thoughtful] I'm sorry, I couldn't quite understand that."
      }

      // Parse emotion tag and set it for the avatar
      const { emotion, text: cleanText } = parseEmotionTag(responseText)
      setCurrentEmotion(emotion)
      setAnswerText(cleanText)

      // TTS + lip sync (use clean text without emotion tag)
      setConvState(STATE.SPEAKING)
      await generateAndPlaySpeech(cleanText)

      // When audio ends, resume listening
      if (audioElementRef.current) {
        audioElementRef.current.addEventListener('ended', () => {
          if (convStateRef.current === STATE.SPEAKING) {
            setConvState(STATE.LISTENING)
          }
        }, { once: true })
      }

    } catch (err) {
      console.error('[VAD] Error:', err)
      setError(err.message || 'Something went wrong')
      setConvState(STATE.LISTENING)
    }
  }

  // === Check if cached audio exists ===
  async function checkAudioExists(filename) {
    try {
      const response = await fetch(`/${filename}.wav`, { method: 'HEAD' })
      return response.ok
    } catch { return false }
  }

  async function loadExistingAudio(filename) {
    const audio = new Audio(`/${filename}.wav`)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Audio loading timeout')), 10000)
      audio.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(audio) })
      audio.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Audio load error')) })
      audio.load()
    })
  }

  // === Generate speech and play with lip sync ===
  async function generateAndPlaySpeech(text) {
    try {
      const MAX_TEXT_LENGTH = 500
      const truncatedText = text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) + '...' : text
      const audioFilename = sanitizeFilename(truncatedText)

      const audioExists = await checkAudioExists(audioFilename)
      let audio
      let audioBlob = null

      if (audioExists) {
        try {
          audio = await loadExistingAudio(audioFilename)
        } catch {
          audio = null
        }
      }

      if (!audio) {
        audioBlob = await generateSpeechWithElevenLabs(truncatedText, {
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          stability: 0.65,
          similarityBoost: 0.85,
          style: 0.15,
          useSpeakerBoost: true
        })

        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl))
      }

      audioElementRef.current = audio

      setAnimationType('thanks')

      // Save audio and generate lip sync
      if (audioBlob) {
        await saveAudioFile(audioBlob, audioFilename).catch(() => {})
      }

      await processLipSyncWithRhubarb(audioFilename)
      setAudioElement(audio)

      // Audio analyser
      try {
        if (analyserRef.current) analyserRef.current.cleanup()
        const analyserChain = createAudioAnalyser(audio)
        analyserRef.current = analyserChain
        setGetAmplitude(analyserChain.getAmplitude)
      } catch {}

      await new Promise(resolve => setTimeout(resolve, 50))

      // Play audio
      audio.currentTime = 0

      // When audio ends, transition state (callers may override with their own listener)
      audio.addEventListener('ended', () => {
        audioElementRef.current = null
      }, { once: true })

      await audio.play()

    } catch (err) {
      console.error('[TTS] Error:', err)
      setError(`Audio error: ${err.message}`)
      if (convStateRef.current === STATE.SPEAKING) {
        setConvState(STATE.LISTENING)
      }
    }
  }

  // === Load lip sync JSON ===
  async function processLipSyncWithRhubarb(filename) {
    try {
      setIsProcessing(true)
      const jsonPath = `/${filename}.json`
      let lipSyncData = null
      const maxAttempts = 10

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(jsonPath, { cache: 'no-cache' })
          if (response.ok) {
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              lipSyncData = await response.json()
              break
            }
          }
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500))
        } catch {
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500))
        }
      }

      if (lipSyncData && lipSyncData.mouthCues && Array.isArray(lipSyncData.mouthCues)) {
        setLipSyncData(lipSyncData)
      } else {
        setLipSyncData({ metadata: { duration: 0 }, mouthCues: [] })
      }
    } catch {
      setLipSyncData({ metadata: { duration: 0 }, mouthCues: [] })
    } finally {
      setIsProcessing(false)
    }
  }

  // === Toggle conversation ===
  const toggleConversation = useCallback(async () => {
    if (convState !== STATE.IDLE) {
      // Stop conversation
      stopVAD()
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
      setCurrentEmotion('neutral')
      setConvState(STATE.IDLE)
      return
    }

    // Start conversation
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startVAD(stream)
      setConvState(STATE.LISTENING)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions.')
    }
  }, [convState])

  // === Handle text input submit ===
  const handleTextSubmit = useCallback(async (e) => {
    e?.preventDefault()
    const input = textInput.trim()
    if (!input || convState === STATE.THINKING || convState === STATE.SPEAKING) return

    setTextInput('')
    setError(null)

    // Pause VAD listening while processing text
    const wasListening = convState === STATE.LISTENING
    setConvState(STATE.THINKING)

    try {
      const predefined = getPredefinedResponse(input)
      let responseText

      if (predefined) {
        responseText = predefined
      } else {
        const limitedHistory = conversationHistory.slice(-20)
        responseText = await getInteractiveResponse(input, limitedHistory)
      }

      setConversationHistory(prev => {
        const updated = [
          ...prev,
          { role: 'user', content: input },
          { role: 'assistant', content: responseText }
        ]
        return updated.slice(-20)
      })

      if (!responseText || !responseText.trim()) {
        responseText = "[thoughtful] I'm sorry, I couldn't quite understand that."
      }

      const { emotion, text: cleanText } = parseEmotionTag(responseText)
      setCurrentEmotion(emotion)
      setAnswerText(cleanText)
      setConvState(STATE.SPEAKING)

      await generateAndPlaySpeech(cleanText)

      // After speech ends, if VAD was active resume listening, otherwise go idle
      if (audioElementRef.current) {
        audioElementRef.current.addEventListener('ended', () => {
          audioElementRef.current = null
          setConvState(wasListening ? STATE.LISTENING : STATE.IDLE)
        }, { once: true })
      }
    } catch (err) {
      console.error('[Text] Error:', err)
      setError(err.message || 'Something went wrong')
      setConvState(wasListening ? STATE.LISTENING : STATE.IDLE)
    }
  }, [textInput, convState, conversationHistory])

  // State display
  const stateLabel = {
    [STATE.IDLE]: 'Start Conversation',
    [STATE.LISTENING]: 'Listening...',
    [STATE.THINKING]: 'Thinking...',
    [STATE.SPEAKING]: 'Speaking...',
  }

  const stateColor = {
    [STATE.IDLE]: '#3b82f6',
    [STATE.LISTENING]: '#22c55e',
    [STATE.THINKING]: '#f59e0b',
    [STATE.SPEAKING]: '#8b5cf6',
  }

  // Loading screen
  if (!sceneReady) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#d4c8a8',
        color: '#4a3a20',
        fontFamily: 'Georgia, serif',
      }}>
        <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 20 }} />
        <div style={{ fontSize: 22, fontWeight: 600 }}>Preparing Ada's Study...</div>
        <div style={{ fontSize: 14, opacity: 0.6, marginTop: 8 }}>Loading 3D environment</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* 3D AVATAR CANVAS */}
      <div className="avatar-section">
        <Canvas
          camera={{ position: [0, 2.2, 7], fov: 45 }}
          shadows='soft'
          gl={{ antialias: true }}
          style={{ background: '#d4c8a8' }}
        >
          <fog attach="fog" args={['#e0d8c0', 14, 35]} />
          <VictorianEnvironment />
          <Avatar />
          <OrbitControls
            minDistance={2}
            maxDistance={12}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 1.2, 0]}
          />
        </Canvas>
      </div>

      {/* BOTTOM BAR */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backdropFilter: 'blur(10px)',
        padding: '14px 20px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Answer text */}
        {answerText && (
          <div style={{
            fontSize: 13,
            color: '#e8dcc8',
            maxWidth: 600,
            textAlign: 'center',
            lineHeight: 1.5,
            opacity: 0.85,
            maxHeight: 60,
            overflow: 'hidden',
          }}>
            {answerText}
          </div>
        )}

        {/* Text input row */}
        <form
          onSubmit={handleTextSubmit}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 650 }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a message..."
            disabled={convState === STATE.THINKING || convState === STATE.SPEAKING}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 14,
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!textInput.trim() || convState === STATE.THINKING || convState === STATE.SPEAKING}
            style={{
              padding: '10px 20px',
              backgroundColor: (!textInput.trim() || convState === STATE.THINKING || convState === STATE.SPEAKING) ? '#555' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 20,
              cursor: (!textInput.trim() || convState === STATE.THINKING || convState === STATE.SPEAKING) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            Send
          </button>

          {/* Voice conversation toggle */}
          <button
            type="button"
            onClick={toggleConversation}
            disabled={convState === STATE.THINKING}
            style={{
              padding: '10px 20px',
              backgroundColor: convState === STATE.IDLE ? 'transparent' : 'transparent',
              color: 'white',
              border: `2px solid ${stateColor[convState]}`,
              borderRadius: 20,
              cursor: convState === STATE.THINKING ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {convState !== STATE.IDLE && (
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: stateColor[convState],
                display: 'inline-block',
                animation: convState === STATE.LISTENING ? 'pulse 1.5s infinite' : 'none',
              }} />
            )}
            {stateLabel[convState]}
          </button>
        </form>

        {error && (
          <div style={{
            fontSize: 12,
            color: '#ef4444',
            padding: '6px 12px',
            backgroundColor: '#fee2e2',
            borderRadius: 8,
            textAlign: 'center',
            maxWidth: 500,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <LipSyncProvider>
      <AppContent />
    </LipSyncProvider>
  )
}
