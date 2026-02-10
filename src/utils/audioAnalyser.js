/**
 * Audio Analyser with Room Reverb
 * Creates a Web Audio API chain: source → analyser → convolver (reverb) → destination
 * Provides real-time amplitude for lip sync modulation
 */

/**
 * Generate a synthetic impulse response for a Victorian library room
 * Short decay (~0.8s), warm tone — simulates a cozy book-filled room
 */
function createRoomImpulseResponse(audioContext) {
  const sampleRate = audioContext.sampleRate
  const duration = 0.8 // seconds — short reverb for a book-lined room
  const length = sampleRate * duration
  const impulse = audioContext.createBuffer(2, length, sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      // Exponential decay with warm low-pass character
      const decay = Math.exp(-t * 5.5) // faster decay = smaller room
      const noise = (Math.random() * 2 - 1)
      // Add some early reflections (book surfaces, wood panels)
      const earlyReflection = i < sampleRate * 0.03
        ? Math.sin(i * 0.1) * 0.3 * Math.exp(-t * 20)
        : 0
      data[i] = (noise * decay * 0.25 + earlyReflection) * (channel === 0 ? 1 : 0.95)
    }
  }

  return impulse
}

/**
 * Create an audio analyser chain with room reverb
 * @param {HTMLAudioElement} audioElement - The audio element to analyse
 * @returns {{ analyser: AnalyserNode, getAmplitude: () => number, cleanup: () => void }}
 */
export function createAudioAnalyser(audioElement) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioContext.createMediaElementSource(audioElement)

  // Analyser for real-time amplitude
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.8
  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  // Convolver for room reverb
  const convolver = audioContext.createConvolver()
  convolver.buffer = createRoomImpulseResponse(audioContext)

  // Dry/wet mix — keep mostly dry with subtle reverb
  const dryGain = audioContext.createGain()
  dryGain.gain.value = 0.82 // 82% dry

  const wetGain = audioContext.createGain()
  wetGain.gain.value = 0.25 // 25% wet reverb

  // Warm EQ — slight low-frequency boost for Victorian room feel
  const warmEQ = audioContext.createBiquadFilter()
  warmEQ.type = 'lowshelf'
  warmEQ.frequency.value = 300
  warmEQ.gain.value = 2.5 // subtle warmth

  // Chain: source → analyser → split to dry + wet → merge → EQ → destination
  source.connect(analyser)

  // Dry path
  analyser.connect(dryGain)
  dryGain.connect(warmEQ)

  // Wet path (reverb)
  analyser.connect(convolver)
  convolver.connect(wetGain)
  wetGain.connect(warmEQ)

  // Output
  warmEQ.connect(audioContext.destination)

  /**
   * Get current normalized amplitude (0–1)
   * Useful for modulating lip sync intensity
   */
  function getAmplitude() {
    analyser.getByteFrequencyData(dataArray)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    return Math.min(1, average / 128) // normalize to 0–1
  }

  function cleanup() {
    try {
      source.disconnect()
      analyser.disconnect()
      convolver.disconnect()
      dryGain.disconnect()
      wetGain.disconnect()
      warmEQ.disconnect()
      audioContext.close()
    } catch (e) {
      // Already disconnected
    }
  }

  return { analyser, getAmplitude, cleanup }
}
