import { useState, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import Avatar from './components/Avatar'
import { getInteractiveResponse, getPredefinedResponse } from './utils/interactive'
import { LipSyncProvider, useLipSyncContext } from './contexts/LipSyncContext'
import { processLipSync } from './utils/lipSync'
import { generateSpeechWithElevenLabs, speechToTextWithElevenLabs } from './utils/elevenlabs'
import { saveAudioFile, sanitizeFilename } from './utils/audioSaver'
import './App.css'

function AppContent() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [answerText, setAnswerText] = useState(null)
  const [isTestingLipSync, setIsTestingLipSync] = useState(false)
  const [isTestingThanks, setIsTestingThanks] = useState(false)
  const [isTestingThanks1, setIsTestingThanks1] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([]) // Store conversation history
  const testAudioContainerRef = useRef(null)
  const thanksAudioContainerRef = useRef(null)
  const thanks1AudioContainerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const { setAudioElement, setLipSyncData, setIsProcessing, setAnimationType } = useLipSyncContext()

  // Check if file server is running on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then(() => {
        console.log('✅ File server is running - files will save to public/ automatically')
      })
      .catch(() => {
        console.warn('⚠️ File server not running. Start it with: npm run server')
        console.warn('   Or run both together with: npm run dev:full')
      })
  }, [])

  // Cleanup recording stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  /**
   * Check if audio file already exists in public folder
   */
  async function checkAudioExists(filename) {
    try {
      const wavPath = `/${filename}.wav`
      const response = await fetch(wavPath, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Load existing audio file from public folder
   */
  async function loadExistingAudio(filename) {
    try {
      const wavPath = `/${filename}.wav`
      const audio = new Audio(wavPath)
      audio.controls = true
      audio.style.width = '100%'
      audio.style.marginTop = '12px'
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout'))
        }, 10000) // 10 second timeout
        
        audio.addEventListener('loadeddata', () => {
          clearTimeout(timeout)
          resolve(audio)
        })
        
        audio.addEventListener('error', (event) => {
          clearTimeout(timeout)
          const errorMsg = audio.error 
            ? `Audio load error: ${audio.error.code} - ${audio.error.message || 'Unknown error'}`
            : 'Failed to load audio file'
          reject(new Error(errorMsg))
        })
        
        audio.load()
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load existing audio: ${errorMsg}`)
    }
  }

  /**
   * Generate speech from text using ElevenLabs API only
   * No browser TTS - uses VITE_ELEVENLABS_API_KEY from .env
   * Optimized with caching and text length limits to reduce API usage
   */
  async function generateSpeechFromText(text) {
    try {
      // Limit text length to prevent excessive character usage (max 500 characters)
      const MAX_TEXT_LENGTH = 500
      const originalText = text
      const truncatedText = text.length > MAX_TEXT_LENGTH 
        ? text.substring(0, MAX_TEXT_LENGTH) + '...'
        : text
      
      if (text.length > MAX_TEXT_LENGTH) {
        console.warn(`⚠️ Text truncated from ${text.length} to ${MAX_TEXT_LENGTH} characters to save API credits`)
      }
      
      const audioFilename = sanitizeFilename(truncatedText)
      
      // Check if audio file already exists (caching)
      console.log('🔍 Checking for existing audio file...')
      const audioExists = await checkAudioExists(audioFilename)
      
      let audio
      let audioBlob = null
      let useExistingAudio = false
      
      if (audioExists) {
        try {
          console.log('✅ Found existing audio file, reusing it (saving API credits)')
          audio = await loadExistingAudio(audioFilename)
          console.log('✅ Successfully loaded existing audio file')
          useExistingAudio = true
        } catch (loadError) {
          console.warn('⚠️ Failed to load existing audio file, generating new one:', loadError.message)
          // Fallback to generating new audio if loading fails
          audio = null
          useExistingAudio = false
        }
      }
      
      if (!useExistingAudio) {
        console.log('🎤 Generating new speech with ElevenLabs API...')
        console.log(`📝 Text length: ${truncatedText.length} characters`)
        
        // Generate speech with ElevenLabs
        audioBlob = await generateSpeechWithElevenLabs(truncatedText, {
          voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel voice (female) - natural and clear
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true
        })
        
        console.log('✅ Speech generated successfully, size:', audioBlob.size, 'bytes')
        
        // Create audio element from the blob
        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.controls = true
        audio.style.width = '100%'
        audio.style.marginTop = '12px'
        
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl)
        })
      }

      // Add audio element to the page immediately
      const audioContainer = document.querySelector('.audio-container') || document.createElement('div')
      audioContainer.className = 'audio-container'
      audioContainer.innerHTML = ''
      audioContainer.appendChild(audio)
      
      const answerDisplay = document.querySelector('.answer-display')
      if (answerDisplay && answerDisplay.parentNode) {
        const existingContainer = answerDisplay.parentNode.querySelector('.audio-container')
        if (existingContainer) {
          existingContainer.remove()
        }
        answerDisplay.parentNode.insertBefore(audioContainer, answerDisplay.nextSibling)
      }

      // Set animation type based on response text (do this early)
      const lowerText = text.toLowerCase()
      if (lowerText.includes('tzaghrita') || lowerText.includes('yell') || lowerText.includes('shout')) {
        setAnimationType('tzaghrita')
        console.log('🎬 Animation set to: tzaghrita (Yelling While Standing)')
      } else {
        setAnimationType('thanks')
        console.log('🎬 Animation set to: default (Offensive Idle)')
      }
      
      // Save audio file and wait for lip sync JSON generation (only if new audio was generated)
      if (audioBlob) {
        console.log('💾 Saving audio file and generating lip sync data...')
        
        // Save audio file first (this triggers Rhubarb processing on server)
        await saveAudioFile(audioBlob, audioFilename).catch((saveError) => {
          console.warn('⚠️ Failed to save audio file:', saveError)
        })
      } else {
        console.log('💾 Using existing audio file, checking for lip sync JSON...')
      }
      
      // Wait for lip sync JSON file to be generated before playing audio
      console.log('⏳ Waiting for lip sync JSON file to be generated...')
      await processLipSyncWithRhubarb(audioFilename)
      
      // Now set audio element for lip sync (after JSON is ready)
      // This ensures lip sync hook can access both audio and data simultaneously
      setAudioElement(audio)
      console.log('✅ Audio element and lip sync data ready and synchronized')
      
      // Small delay to ensure everything is fully initialized
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Play audio smoothly with synchronized lip sync
      console.log('🎉 Starting synchronized audio playback with lip sync...')
      try {
        // Reset audio to start for perfect sync
        audio.currentTime = 0
        await audio.play()
        console.log('🔊 Audio playing smoothly with synchronized lip sync from start')
      } catch (playError) {
        console.log('⚠️ Autoplay blocked, user can click play button')
      }

      return audio
    } catch (error) {
      console.error('❌ Text-to-speech error:', error)
      throw error
    }
  }

  /**
   * Load lip sync JSON from public/ folder (after Rhubarb processing)
   * Waits for Rhubarb to finish processing before loading
   * The server automatically processes audio with Rhubarb after saving
   * Returns a promise that resolves when lip sync data is loaded
   */
  async function processLipSyncWithRhubarb(filename) {
    try {
      console.log('🎬 Loading lip sync data from public/ folder...')
      setIsProcessing(true)
      
      // Load JSON file from public/ folder
      // The server is processing it with Rhubarb in background
      const jsonFilename = `${filename}.json`
      const jsonPath = `/${jsonFilename}`
      
      console.log('📥 Waiting for Rhubarb to generate:', jsonPath)
      
      // Wait for JSON file to be ready (Rhubarb takes 1-3 seconds to process)
      let lipSyncData = null
      const maxAttempts = 10
      const waitTime = 500 // Check every 500ms
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(jsonPath, { cache: 'no-cache' })
          
          if (response.ok) {
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              lipSyncData = await response.json()
              console.log(`✅ Lip sync JSON loaded successfully (attempt ${attempt})`)
              break
            }
          }
          
          // File not ready yet, wait and retry
          if (attempt < maxAttempts) {
            console.log(`⏳ Waiting for Rhubarb processing... (${attempt}/${maxAttempts})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        } catch (error) {
          // Network error or file not ready, retry
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
      
      if (lipSyncData && lipSyncData.mouthCues && Array.isArray(lipSyncData.mouthCues)) {
        setLipSyncData(lipSyncData)
        console.log('✅ Lip sync data loaded and ready:', {
          mouthCuesCount: lipSyncData.mouthCues.length,
          duration: lipSyncData.metadata?.duration || 0
        })
      } else {
        console.warn('⚠️ No valid lip sync data found after waiting, using fallback animation')
        setLipSyncData({
          metadata: { duration: 0 },
          mouthCues: []
        })
      }
    } catch (error) {
      console.error('❌ Error loading lip sync data:', error)
      console.warn('⚠️ Using fallback animation - audio will still play')
      
      // Use fallback animation on error - don't block audio playback
      setLipSyncData({
        metadata: { duration: 0 },
        mouthCues: []
      })
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Helper function to load and play lip sync files
   */
  async function loadLipSyncFiles(jsonPath, wavPath, containerRef, setIsLoading) {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log(`🎬 Loading lip sync files: ${jsonPath} & ${wavPath}`)
      
      // Load JSON file
      const jsonResponse = await fetch(jsonPath)
      if (!jsonResponse.ok) {
        throw new Error(`Failed to load JSON file: ${jsonResponse.status}`)
      }
      const lipSyncData = await jsonResponse.json()
      console.log('✅ Loaded lip sync data:', lipSyncData)
      
      // Load audio file
      const audio = new Audio(wavPath)
      audio.controls = true
      audio.style.width = '100%'
      audio.style.marginTop = '12px'
      
      // Set up audio event listeners
      audio.addEventListener('loadeddata', () => {
        console.log('✅ Audio file loaded, duration:', audio.duration)
      })
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio load error:', e)
        setError('Failed to load audio file')
        setIsLoading(false)
      })
      
      // Set lip sync data and audio element
      setLipSyncData(lipSyncData)
      setAudioElement(audio)
      
      // Set animation type based on which file is being loaded
      // Both 'thanks' and 'thanks_1' use the same animations
      if (wavPath.includes('thanks')) {
        setAnimationType('thanks')
        console.log('🎬 Animation set to: thanks (Salute → Offensive Idle)')
      } else if (wavPath.includes('tzaghrita')) {
        setAnimationType('tzaghrita')
        console.log('🎬 Animation set to: tzaghrita (Yelling While Standing)')
      } else {
        setAnimationType(null)
      }
      
      console.log('✅ Lip sync data and audio set, ready to play')
      
      // Add audio element to container for display
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(audio)
      }
      
      // Auto-play audio (may be blocked by browser)
      try {
        await audio.play()
        console.log('🔊 Audio playing')
      } catch (playError) {
        console.log('⚠️ Autoplay blocked, user can click play button on audio element')
        // Audio element will be visible with controls, user can click play
      }
      
    } catch (err) {
      console.error('❌ Error loading lip sync files:', err)
      setError(err.message || 'Failed to load lip sync files')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Test lip sync with tzaghrita files
   */
  async function testHardcodedLipSync() {
    await loadLipSyncFiles('/tzaghrita.json', '/tzaghrita.wav', testAudioContainerRef, setIsTestingLipSync)
  }

  /**
   * Test lip sync with thanks files
   */
  async function testThanksLipSync() {
    await loadLipSyncFiles('/thanks.json', '/thanks.wav', thanksAudioContainerRef, setIsTestingThanks)
  }

  /**
   * Test lip sync with thanks_1 files
   */
  async function testThanks1LipSync() {
    await loadLipSyncFiles('/thanks_1.json', '/thanks_1.wav', thanks1AudioContainerRef, setIsTestingThanks1)
  }

  /**
   * Start recording audio from microphone
   */
  async function startRecording() {
    try {
      console.log('🎤 Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped')
        // Convert recorded chunks to blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        // Convert WebM to WAV for ElevenLabs STT
        const wavBlob = await convertWebMToWav(audioBlob)
        
        // Transcribe using ElevenLabs
        setIsTranscribing(true)
        try {
          const transcribedText = await speechToTextWithElevenLabs(wavBlob, {
            modelId: 'scribe_v1',
            languageCode: 'en',
            diarize: false
          })
          
          console.log('✅ Transcribed text:', transcribedText)
          
          if (transcribedText && transcribedText.trim()) {
            // Set the transcribed text in the textarea
            setText(transcribedText)
            // Automatically submit the form
            await handleSubmitWithText(transcribedText)
          } else {
            setError('No speech detected. Please try again.')
          }
        } catch (sttError) {
          console.error('❌ STT Error:', sttError)
          setError(`Failed to transcribe audio: ${sttError.message}`)
        } finally {
          setIsTranscribing(false)
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log('✅ Recording started')
    } catch (err) {
      console.error('❌ Error accessing microphone:', err)
      setError('Failed to access microphone. Please check permissions.')
      setIsRecording(false)
    }
  }

  /**
   * Stop recording audio
   */
  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      console.log('🛑 Stopping recording...')
    }
  }

  /**
   * Convert WebM blob to WAV blob
   */
  async function convertWebMToWav(webmBlob) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const arrayBuffer = await webmBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // Convert AudioBuffer to WAV
      const wav = audioBufferToWav(audioBuffer)
      const wavBlob = new Blob([wav], { type: 'audio/wav' })
      
      audioContext.close()
      return wavBlob
    } catch (error) {
      console.error('❌ Error converting WebM to WAV:', error)
      throw error
    }
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  function audioBufferToWav(buffer) {
    const length = buffer.length
    const sampleRate = buffer.sampleRate
    const channels = buffer.numberOfChannels
    const arrayBuffer = new ArrayBuffer(44 + length * channels * 2)
    const view = new DataView(arrayBuffer)
    let offset = 0

    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
      offset += str.length
    }

    // WAV header
    writeString('RIFF')
    view.setUint32(offset, 36 + length * channels * 2, true)
    offset += 4
    writeString('WAVE')
    writeString('fmt ')
    view.setUint32(offset, 16, true)
    offset += 4
    view.setUint16(offset, 1, true) // PCM format
    offset += 2
    view.setUint16(offset, channels, true)
    offset += 2
    view.setUint32(offset, sampleRate, true)
    offset += 4
    view.setUint32(offset, sampleRate * channels * 2, true) // Byte rate
    offset += 4
    view.setUint16(offset, channels * 2, true) // Block align
    offset += 2
    view.setUint16(offset, 16, true) // Bits per sample
    offset += 2
    writeString('data')
    view.setUint32(offset, length * channels * 2, true)
    offset += 4

    // Convert float samples to 16-bit PCM
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

  /**
   * Handle submit with text (used for both manual and voice input)
   * Maintains conversation history for context
   */
  async function handleSubmitWithText(inputText) {
    if (!inputText || !inputText.trim()) {
      setError('Please enter some text')
      return
    }

    setLoading(true)
    setError(null)
    setAnswerText(null)

    try {
      const userQuery = inputText.trim()
      
      // Check for predefined responses first
      const predefined = getPredefinedResponse(userQuery)
      let responseText = null
      
      if (predefined) {
        responseText = predefined
        console.log('✅ Using predefined response:', responseText)
        // Still add to conversation history for context
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: userQuery },
          { role: 'assistant', content: responseText }
        ])
      } else {
        // Limit conversation history to last 10 exchanges (20 messages) to avoid token limits
        // Keep the most recent messages for better context
        const limitedHistory = conversationHistory.slice(-20)
        
        // Get interactive response with conversation history
        console.log('🔄 Calling OpenAI API for:', userQuery)
        console.log(`📚 Sending ${limitedHistory.length} previous messages for context`)
        
        responseText = await getInteractiveResponse(userQuery, limitedHistory)
        console.log('✅ Received response:', responseText)
        
        // Update conversation history with new exchange
        // Keep only last 20 messages (10 exchanges) to manage token usage
        setConversationHistory(prev => {
          const updated = [
            ...prev,
            { role: 'user', content: userQuery },
            { role: 'assistant', content: responseText }
          ]
          // Keep only last 20 messages (10 exchanges)
          return updated.slice(-20)
        })
      }
      
      // Ensure we have text
      if (!responseText || !responseText.trim()) {
        responseText = "I'm sorry, I couldn't process that request."
      }
      
      setAnswerText(responseText)
      
      // Show character count warning for long responses
      if (responseText.length > 400) {
        console.warn(`⚠️ Long response (${responseText.length} chars) - will be truncated to 500 chars for TTS`)
      }
      
      // Convert text to speech using ElevenLabs API only
      try {
        await generateSpeechFromText(responseText)
      } catch (ttsError) {
        // Extract error message safely
        const errorMessage = ttsError instanceof Error 
          ? ttsError.message 
          : (ttsError?.message || String(ttsError))
        
        console.error('TTS Error:', ttsError)
        
        // Check if it's a quota error
        if (errorMessage && (errorMessage.includes('quota') || errorMessage.includes('credit') || errorMessage.includes('exceed'))) {
          setError(`ElevenLabs API Quota Exceeded: ${errorMessage}. The response text is displayed above, but audio generation failed. Please check your ElevenLabs account credits.`)
          // Don't throw - show the text response even if audio fails
          return
        }
        
        // For other audio errors, show warning but don't block
        setError(`Audio generation failed: ${errorMessage}. The response text is displayed above.`)
        console.warn('Audio generation failed, but continuing with text response')
        return
      }

    } catch (err) {
      console.error('Error:', err)
      const errorMessage = err.message || 'There was an issue processing your request.'
      
      // Provide helpful error messages
      if (errorMessage.includes('Cannot connect to OpenAI API') || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('ERR_CONNECTION') ||
          errorMessage.includes('NetworkError')) {
        setError('Cannot connect to OpenAI API. Please check your internet connection.')
      } else {
        setError(errorMessage)
      }
      
      setAnswerText("I encountered an error processing your request. " + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Clear conversation history
   */
  function clearConversation() {
    setConversationHistory([])
    setAnswerText(null)
    setText('')
    console.log('🗑️ Conversation history cleared')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await handleSubmitWithText(text)
  }

  return (
    <div className="app-container">
      {/* 3D AVATAR CANVAS */}
      <div className="avatar-section">
        <Canvas camera={{ position: [0, 1.6, 3], fov: 35 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />

          <Avatar />

          <OrbitControls />
          <Environment preset="studio" />
        </Canvas>
      </div>

      {/* TEXT INPUT SECTION */}
      <div className="tts-section">
        <div className="tts-container">
          <h2 className="section-title">Chat with AI</h2>
          
          {/* TEST LIP SYNC BUTTONS */}
          <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            {/* Tzaghrita Test */}
            <div style={{ padding: '15px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#92400e', fontSize: '16px' }}>
                🎬 Test 1: Tzaghrita
              </h3>
              <p style={{ marginBottom: '15px', color: '#78350f', fontSize: '12px' }}>
                tzaghrita.json & tzaghrita.wav
              </p>
              <button 
                type="button"
                onClick={testHardcodedLipSync}
                disabled={isTestingLipSync}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isTestingLipSync ? '#d1d5db' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: isTestingLipSync ? 'not-allowed' : 'pointer',
                  width: '100%'
                }}
              >
                {isTestingLipSync ? 'Loading...' : '🎬 Play'}
              </button>
              <div ref={testAudioContainerRef} style={{ marginTop: '15px' }}></div>
            </div>

            {/* Thanks Test */}
            <div style={{ padding: '15px', backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#1e40af', fontSize: '16px' }}>
                🎬 Test 2: Thanks
              </h3>
              <p style={{ marginBottom: '15px', color: '#1e3a8a', fontSize: '12px' }}>
                thanks.json & thanks.wav
              </p>
              <button 
                type="button"
                onClick={testThanksLipSync}
                disabled={isTestingThanks}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isTestingThanks ? '#d1d5db' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: isTestingThanks ? 'not-allowed' : 'pointer',
                  width: '100%'
                }}
              >
                {isTestingThanks ? 'Loading...' : '🎬 Play'}
              </button>
              <div ref={thanksAudioContainerRef} style={{ marginTop: '15px' }}></div>
            </div>

            {/* Thanks_1 Test */}
            <div style={{ padding: '15px', backgroundColor: '#fce7f3', border: '2px solid #ec4899', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#9f1239', fontSize: '16px' }}>
                🎬 Test 3: Thanks_1
              </h3>
              <p style={{ marginBottom: '15px', color: '#831843', fontSize: '12px' }}>
                thanks_1.json & thanks_1.wav
              </p>
              <button 
                type="button"
                onClick={testThanks1LipSync}
                disabled={isTestingThanks1}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isTestingThanks1 ? '#d1d5db' : '#ec4899',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: isTestingThanks1 ? 'not-allowed' : 'pointer',
                  width: '100%'
                }}
              >
                {isTestingThanks1 ? 'Loading...' : '🎬 Play'}
              </button>
              <div ref={thanks1AudioContainerRef} style={{ marginTop: '15px' }}></div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="tts-form">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label htmlFor="text-input" style={{ marginBottom: 0 }}>Enter your question:</label>
                {conversationHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearConversation}
                    disabled={loading || isRecording || isTranscribing}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255, 59, 48, 0.2)',
                      color: '#ff6b6b',
                      border: '1px solid rgba(255, 59, 48, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: (loading || isRecording || isTranscribing) ? 'not-allowed' : 'pointer',
                      opacity: (loading || isRecording || isTranscribing) ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    title={`Clear conversation history (${conversationHistory.length} messages)`}
                  >
                    🗑️ Clear History ({conversationHistory.length / 2})
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <textarea
                  id="text-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your question here or use the microphone..."
                  rows={6}
                  maxLength={1000}
                  disabled={loading || isRecording || isTranscribing}
                  style={{ flex: 1 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={loading || isTranscribing}
                      style={{
                        padding: '12px',
                        backgroundColor: isTranscribing ? '#d1d5db' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        cursor: isTranscribing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                      }}
                      title="Start recording"
                    >
                      🎤
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      disabled={false}
                      style={{
                        padding: '12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        animation: 'pulse 1.5s infinite'
                      }}
                      title="Stop recording"
                    >
                      ⏹️
                    </button>
                  )}
                  {isTranscribing && (
                    <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                      Transcribing...
                    </div>
                  )}
                  {isRecording && (
                    <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center', fontWeight: 'bold' }}>
                      Recording...
                    </div>
                  )}
                </div>
              </div>
              <div className="char-count">{text.length}/1000</div>
            </div>
            
            <button type="submit" disabled={loading || !text.trim() || isRecording || isTranscribing} className="generate-button">
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Processing...
                </>
              ) : isTranscribing ? (
                <>
                  <span className="loading-spinner"></span>
                  Transcribing...
                </>
              ) : (
                'Send'
              )}
            </button>

            {/* SHOW THE ANSWER */}
            {answerText && (
              <div className="answer-display" style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#1e40af',
                fontWeight: '500'
              }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Answer:</span>
                  {answerText.length > 400 && (
                    <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'normal' }}>
                      ⚠️ {answerText.length} chars (will truncate to 500 for audio)
                    </span>
                  )}
                </div>
                <div>{answerText}</div>
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
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
