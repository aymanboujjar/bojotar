/**
 * ElevenLabs Text-to-Speech API integration
 * Uses VITE_ELEVENLABS_API_KEY from .env file
 */

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const ELEVENLABS_STT_API_URL = 'https://api.elevenlabs.io/v1/speech-to-text'

/**
 * Get available voices from ElevenLabs
 * @returns {Promise<Array>} - Array of available voices
 */
export async function getElevenLabsVoices() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not found. Please set VITE_ELEVENLABS_API_KEY in .env file')
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    const data = await response.json()
    return data.voices || []
  } catch (error) {
    console.error('❌ Error fetching ElevenLabs voices:', error)
    throw error
  }
}

/**
 * Generate speech from text using ElevenLabs API
 * @param {string} text - Text to convert to speech
 * @param {object} options - Optional configuration
 * @param {string} options.voiceId - Voice ID (default: '21m00Tcm4TlvDq8ikWAM' - Rachel, female voice)
 * @param {number} options.stability - Stability setting (0-1, default: 0.5)
 * @param {number} options.similarityBoost - Similarity boost (0-1, default: 0.75)
 * @param {number} options.style - Style setting (0-1, default: 0.0)
 * @param {boolean} options.useSpeakerBoost - Use speaker boost (default: true)
 * @returns {Promise<Blob>} - Audio blob (WAV format)
 */
export async function generateSpeechWithElevenLabs(text, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not found. Please set VITE_ELEVENLABS_API_KEY in .env file')
  }

  const {
    voiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel voice (female) - default
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true
  } = options

  try {
    console.log('🎤 Generating speech with ElevenLabs API...')
    console.log(`📝 Text length: ${text.length} characters`)
    console.log(`🎙️ Voice ID: ${voiceId}`)

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: stability,
          similarity_boost: similarityBoost,
          style: style,
          use_speaker_boost: useSpeakerBoost
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `ElevenLabs API error: ${response.status}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail?.message || errorJson.message || errorMessage
        
        // Check for quota/credit errors
        if (errorMessage.includes('quota') || errorMessage.includes('credit') || errorMessage.includes('exceed')) {
          errorMessage = `ElevenLabs quota exceeded: ${errorMessage}. Please check your account credits or wait for quota reset.`
        }
      } catch {
        errorMessage = errorText || errorMessage
      }
      
      throw new Error(errorMessage)
    }

    // Get audio as blob (MP3 format from ElevenLabs)
    const mp3Blob = await response.blob()
    console.log(`✅ Speech generated successfully, size: ${mp3Blob.size} bytes`)

    // Convert MP3 to WAV for compatibility with Rhubarb
    const wavBlob = await convertMp3ToWav(mp3Blob)
    
    return wavBlob
  } catch (error) {
    console.error('❌ ElevenLabs TTS Error:', error)
    throw new Error(error.message || 'Failed to generate speech with ElevenLabs')
  }
}

/**
 * Convert MP3 blob to WAV blob
 * @param {Blob} mp3Blob - MP3 audio blob
 * @returns {Promise<Blob>} - WAV audio blob
 */
async function convertMp3ToWav(mp3Blob) {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Decode MP3 to AudioBuffer
    const arrayBuffer = await mp3Blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    // Convert AudioBuffer to WAV
    const wav = audioBufferToWav(audioBuffer)
    const wavBlob = new Blob([wav], { type: 'audio/wav' })
    
    audioContext.close()
    return wavBlob
  } catch (error) {
    console.error('❌ Error converting MP3 to WAV:', error)
    // If conversion fails, return original blob (might still work)
    return mp3Blob
  }
}

/**
 * Convert AudioBuffer to WAV format
 * @param {AudioBuffer} buffer - Audio buffer to convert
 * @returns {ArrayBuffer} - WAV file data
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
 * Convert speech to text using ElevenLabs Speech-to-Text API
 * @param {Blob} audioBlob - Audio blob to transcribe (WAV, MP3, OGG, etc.)
 * @param {object} options - Optional configuration
 * @param {string} options.modelId - Model ID (default: 'scribe_v1')
 * @param {string} options.languageCode - Language code (default: 'en')
 * @param {boolean} options.diarize - Enable speaker diarization (default: false)
 * @returns {Promise<string>} - Transcribed text
 */
export async function speechToTextWithElevenLabs(audioBlob, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not found. Please set VITE_ELEVENLABS_API_KEY in .env file')
  }

  const {
    modelId = 'scribe_v1',
    languageCode = 'en',
    diarize = false
  } = options

  try {
    console.log('🎤 Transcribing speech with ElevenLabs API...')
    console.log(`📝 Audio size: ${audioBlob.size} bytes`)
    console.log(`🌐 Language: ${languageCode}`)

    // Create FormData for multipart/form-data request
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model_id', modelId)
    formData.append('language_code', languageCode)
    if (diarize) {
      formData.append('diarize', 'true')
    }

    const response = await fetch(ELEVENLABS_STT_API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `ElevenLabs STT API error: ${response.status}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail?.message || errorJson.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      
      throw new Error(errorMessage)
    }

    const result = await response.json()
    const transcribedText = result.text || ''
    
    console.log(`✅ Transcription successful: "${transcribedText}"`)
    return transcribedText.trim()
  } catch (error) {
    console.error('❌ ElevenLabs STT Error:', error)
    throw new Error(error.message || 'Failed to transcribe speech with ElevenLabs')
  }
}
