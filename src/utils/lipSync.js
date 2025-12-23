const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.100.100:8000'

/**
 * Process audio with Rhubarb Lip Sync
 * @param {string|HTMLAudioElement} audio - Audio URL or audio element
 * @returns {Promise<object>} - Lip sync data with mouth cues
 */
/**
 * Convert data URL to blob
 */
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * Send audio blob to backend for processing
 */
async function sendAudioBlob(blob) {
  const formData = new FormData()
  formData.append('audio', blob, 'audio.wav')
  
  console.log('Sending audio blob for lip sync processing...')
  
  const res = await fetch(`${API_BASE_URL}/api/lipsync-file`, {
    method: 'POST',
    body: formData,
  })
  
        if (!res.ok) {
          // If error, return empty data for fallback animation
          console.warn('Lip sync API error, using fallback animation')
          return {
            metadata: { duration: 0 },
            mouthCues: []
          }
        }
        
        const result = await res.json()
        return result.data || result
}

export async function processLipSync(audio) {
  try {
    let audioUrl
    let audioBlob = null
    
    // Extract URL from audio element or use provided URL
    if (audio instanceof HTMLAudioElement) {
      audioUrl = audio.src
      
      // Handle data URLs (base64 encoded audio)
      if (audioUrl.startsWith('data:')) {
        console.log('Detected data URL, converting to blob...')
        audioBlob = dataURLtoBlob(audioUrl)
        return await sendAudioBlob(audioBlob)
      }
      
      // Handle blob URLs
      if (audioUrl.startsWith('blob:')) {
        const response = await fetch(audioUrl)
        audioBlob = await response.blob()
        return await sendAudioBlob(audioBlob)
      }
    } else {
      audioUrl = audio
      
      // Check if it's a data URL string
      if (typeof audioUrl === 'string' && audioUrl.startsWith('data:')) {
        console.log('Detected data URL string, converting to blob...')
        audioBlob = dataURLtoBlob(audioUrl)
        return await sendAudioBlob(audioBlob)
      }
    }
    
    // For regular URLs, use the URL endpoint
    console.log('Processing lip sync for audio URL:', audioUrl.substring(0, 100) + '...')
    
    const res = await fetch(`${API_BASE_URL}/api/lipsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    })

    if (!res.ok) {
      // If error, return empty data for fallback animation
      console.warn('Lip sync API error, using fallback animation')
      return {
        metadata: { duration: 0 },
        mouthCues: []
      }
    }

    const data = await res.json()
    
    // Always return data, even if empty (fallback animation will be used)
    return data.data || {
      metadata: { duration: 0 },
      mouthCues: []
    }
  } catch (error) {
    console.error('Lip sync processing error:', error)
    throw error
  }
}

/**
 * Map Rhubarb mouth shapes to viseme indices
 * Rhubarb uses: A, B, C, D, E, F, G, H, X
 * Common viseme mapping:
 * A -> viseme_aa
 * B -> viseme_oh
 * C -> viseme_ou
 * D -> viseme_ee
 * E -> viseme_ih
 * F -> viseme_ff
 * G -> viseme_th
 * H -> viseme_kk
 * X -> viseme_sil (silence/closed)
 */
export const RHUBARB_TO_VISEME = {
  'A': 'viseme_aa',
  'B': 'viseme_oh', 
  'C': 'viseme_ou',
  'D': 'viseme_ee',
  'E': 'viseme_ih',
  'F': 'viseme_ff',
  'G': 'viseme_th',
  'H': 'viseme_kk',
  'X': 'viseme_sil',
}

