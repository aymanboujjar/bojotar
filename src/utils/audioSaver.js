/**
 * Utility functions for saving audio files to public/ folder
 * Uses local server API - completely automatic, no dialogs
 */

/**
 * Sanitize a string to be used as a filename
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(text) {
  // Take first 50 characters, remove special chars, replace spaces with underscores
  return text
    .substring(0, 50)
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'audio'
}

/**
 * Save audio blob to public/ folder via local server
 * Completely automatic - no dialogs, no user interaction needed
 * @param {Blob} audioBlob - Audio blob to save
 * @param {string} filename - Desired filename (without extension)
 * @returns {Promise<void>}
 */
/**
 * Convert ArrayBuffer to base64 in chunks to avoid stack overflow
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000 // 32KB chunks
  let binary = ''
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  
  return btoa(binary)
}

export async function saveAudioFile(audioBlob, filename) {
  const fullFilename = `${filename}.wav`
  
  try {
    // Convert blob to base64 for transmission (using chunked approach to avoid stack overflow)
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = arrayBufferToBase64(arrayBuffer)
    
    // Send to local server
    const response = await fetch('http://localhost:3001/api/save-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: fullFilename,
        audioData: base64Audio
      })
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Server error: ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log(`✅ Audio saved to public/: ${result.filename}`)
    console.log(`✅ Rhubarb processing: ${result.filename.replace('.wav', '.json')}`)
    
  } catch (error) {
    console.error('❌ Error saving audio file:', error)
    
    // Check if server is running
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      console.warn('⚠️ File server not running. Please start it with: npm run server')
      console.warn('   Or run both together with: npm run dev:full')
    }
    
    throw error
  }
}

/**
 * Legacy functions for compatibility (no longer needed but kept for imports)
 */
export async function initializeFolderAccess() {
  // No-op - not needed with server approach
  return null
}

export async function requestRhubarbFolderAccess() {
  // No-op - not needed with server approach
  return null
}
