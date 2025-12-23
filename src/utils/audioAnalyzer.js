/**
 * Advanced Audio Analyzer for ultra-realistic lip sync
 * Uses formant analysis, spectral analysis, and phoneme detection
 */

export class AudioAnalyzer {
  constructor(audioElement) {
    this.audioElement = audioElement
    this.audioContext = null
    this.analyser = null
    this.timeAnalyser = null
    this.frequencyData = null
    this.timeData = null
    this.source = null
    this.isAnalyzing = false
    this.sampleRate = 44100
  }

  async start() {
    if (!this.audioElement || this.isAnalyzing) return

    try {
      // Resume audio context if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
        this.sampleRate = this.audioContext.sampleRate
      }
      
      // Create analyser nodes with higher resolution for better analysis
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048 // Higher resolution for better frequency analysis
      this.analyser.smoothingTimeConstant = 0.3 // Less smoothing for more responsive detection
      
      // Disconnect existing source if any
      if (this.source) {
        try {
          this.source.disconnect()
        } catch (e) {}
      }
      
      this.source = this.audioContext.createMediaElementSource(this.audioElement)
      
      // Connect analyser to source
      this.source.connect(this.analyser)
      this.analyser.connect(this.audioContext.destination)
      
      // Create data arrays
      const bufferLength = this.analyser.frequencyBinCount
      this.frequencyData = new Uint8Array(bufferLength)
      this.timeData = new Float32Array(this.analyser.fftSize)
      
      this.isAnalyzing = true
    } catch (error) {
      console.warn('Audio analysis not available:', error)
      this.isAnalyzing = false
    }
  }

  stop() {
    if (this.source) {
      try {
        this.source.disconnect()
      } catch (e) {}
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
    this.isAnalyzing = false
  }

  // Calculate formants (vowel characteristics)
  calculateFormants() {
    if (!this.frequencyData || !this.audioContext) return { f1: 0, f2: 0, f3: 0 }
    
    const nyquist = this.audioContext.sampleRate / 2
    const binSize = nyquist / this.frequencyData.length
    
    // Find peaks in frequency spectrum (formants)
    const peaks = []
    for (let i = 1; i < this.frequencyData.length - 1; i++) {
      if (this.frequencyData[i] > this.frequencyData[i - 1] && 
          this.frequencyData[i] > this.frequencyData[i + 1] &&
          this.frequencyData[i] > 50) { // Threshold
        peaks.push({
          freq: i * binSize,
          amplitude: this.frequencyData[i]
        })
      }
    }
    
    // Sort by amplitude and get top 3 (F1, F2, F3)
    peaks.sort((a, b) => b.amplitude - a.amplitude)
    
    return {
      f1: peaks[0]?.freq || 0, // First formant (mouth openness)
      f2: peaks[1]?.freq || 0, // Second formant (tongue position)
      f3: peaks[2]?.freq || 0  // Third formant
    }
  }

  // Detect phoneme type based on spectral characteristics
  detectPhonemeType(formants, volume, spectralCentroid) {
    const { f1, f2 } = formants
    
    // Very low volume = silence
    if (volume < 0.05) return 'silence'
    
    // High F1 (500-1000 Hz) = open vowels (A, O)
    if (f1 > 500 && f1 < 1000) {
      if (f2 < 1500) return 'open_back' // O, U
      return 'open_front' // A
    }
    
    // Medium F1 (300-500 Hz) = mid vowels
    if (f1 > 300 && f1 < 500) {
      if (f2 > 2000) return 'mid_front' // E, I
      return 'mid_back' // O variants
    }
    
    // Low F1 (< 300 Hz) = closed vowels (I, E)
    if (f1 < 300 && f2 > 2000) return 'closed_front' // I, E
    
    // High frequency content = consonants (F, S, TH)
    if (spectralCentroid > 3000) return 'consonant_fricative'
    
    // Low frequency burst = plosives (P, B, T, D)
    if (volume > 0.3 && spectralCentroid < 1000) return 'consonant_plosive'
    
    return 'vowel_mid'
  }

  getAudioData() {
    if (!this.isAnalyzing || !this.analyser || !this.frequencyData) {
      return {
        volume: 0,
        frequency: 0,
        intensity: 0,
        formants: { f1: 0, f2: 0, f3: 0 },
        phonemeType: 'silence',
        spectralCentroid: 0,
        spectralRolloff: 0,
        zeroCrossingRate: 0
      }
    }

    // Get frequency and time data
    this.analyser.getByteFrequencyData(this.frequencyData)
    // Use the same analyser for time data (more efficient)
    const timeDataArray = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(timeDataArray)
    this.timeData = timeDataArray
    
    // Calculate RMS volume from time domain (more accurate)
    let sumSquares = 0
    for (let i = 0; i < this.timeData.length; i++) {
      sumSquares += this.timeData[i] * this.timeData[i]
    }
    const rms = Math.sqrt(sumSquares / this.timeData.length)
    const volume = Math.min(1, rms * 10) // Scale to 0-1
    
    // Calculate spectral centroid (brightness)
    let weightedSum = 0
    let magnitudeSum = 0
    const nyquist = this.audioContext.sampleRate / 2
    const binSize = nyquist / this.frequencyData.length
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i] / 255
      const frequency = i * binSize
      weightedSum += frequency * magnitude
      magnitudeSum += magnitude
    }
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
    
    // Calculate spectral rolloff (frequency below which 85% of energy is)
    let energySum = 0
    const totalEnergy = Array.from(this.frequencyData).reduce((sum, val) => sum + val, 0)
    const rolloffThreshold = totalEnergy * 0.85
    
    let spectralRolloff = 0
    for (let i = 0; i < this.frequencyData.length; i++) {
      energySum += this.frequencyData[i]
      if (energySum >= rolloffThreshold) {
        spectralRolloff = i * binSize
        break
      }
    }
    
    // Calculate zero-crossing rate (for detecting consonants)
    let zeroCrossings = 0
    for (let i = 1; i < this.timeData.length; i++) {
      if ((this.timeData[i - 1] >= 0 && this.timeData[i] < 0) ||
          (this.timeData[i - 1] < 0 && this.timeData[i] >= 0)) {
        zeroCrossings++
      }
    }
    const zeroCrossingRate = zeroCrossings / this.timeData.length
    
    // Get dominant frequency
    let maxIndex = 0
    let maxValue = 0
    for (let i = 0; i < this.frequencyData.length; i++) {
      if (this.frequencyData[i] > maxValue) {
        maxValue = this.frequencyData[i]
        maxIndex = i
      }
    }
    const dominantFrequency = maxIndex * binSize
    
    // Calculate formants
    const formants = this.calculateFormants()
    
    // Detect phoneme type
    const phonemeType = this.detectPhonemeType(formants, volume, spectralCentroid)
    
    // Calculate intensity (how "active" the audio is)
    const intensity = Math.min(1, volume * 2)
    
    return {
      volume,
      frequency: dominantFrequency,
      intensity,
      formants,
      phonemeType,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      rawFrequencyData: Array.from(this.frequencyData),
      rawTimeData: Array.from(this.timeData)
    }
  }
}
