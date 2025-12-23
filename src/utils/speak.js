import puter from "@heyputer/puter.js";

/**
 * Generate speech from text using Puter.js
 * @param {string} text - The text to convert to speech
 * @param {object} options - Optional configuration
 * @returns {Promise<HTMLAudioElement>} - Audio element that can be played
 */
export async function speak(text, options = {}) {
  try {
    console.log('Generating speech with Puter.js:', text.substring(0, 50) + '...')
    
    // Use Puter.js to generate speech with ElevenLabs provider
    const result = await puter.ai.txt2speech(text, {
      provider: options.provider || "elevenlabs",
      voice: options.voice || "21m00Tcm4TlvDq8ikWAM", // Rachel voice
      model: options.model || "eleven_multilingual_v2",
      ...options
    })
    
    // Handle Puter.js error responses
    if (result && typeof result === 'object' && result.success === false) {
      const errorMsg = result.error?.message || result.error || 'TTS generation failed'
      throw new Error(errorMsg)
    }
    
    // Puter.js may return an audio element directly or an audio blob
    let audio;
    if (result instanceof HTMLAudioElement) {
      // Already an audio element
      audio = result;
    } else if (result instanceof Blob) {
      // Convert blob to audio element
      const audioUrl = URL.createObjectURL(result);
      audio = new Audio(audioUrl);
      // Clean up URL when audio ends
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      });
    } else {
      throw new Error('Unexpected response type from Puter.js');
    }
    
    console.log('Speech generated successfully')
    return audio
  } catch (error) {
    console.error('Puter.js TTS Error:', error)
    throw new Error(error.message || 'Failed to generate speech. Please try again.')
  }
}
