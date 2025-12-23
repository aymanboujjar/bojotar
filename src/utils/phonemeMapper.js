/**
 * Maps phoneme types and audio characteristics to visemes
 * This creates the most realistic lip sync possible
 */

export function mapPhonemeToVisemes(phonemeType, formants, volume, spectralCentroid, dict, infl) {
  const { f1, f2 } = formants
  
  // Reset all visemes first
  infl.fill(0)
  
  // Map phoneme types to visemes with blending
  switch (phonemeType) {
    case 'silence':
      if (dict.viseme_sil !== undefined) infl[dict.viseme_sil] = 1.0
      else if (dict.viseme_X !== undefined) infl[dict.viseme_X] = 1.0
      break
      
    case 'open_back': // O, U sounds
      // Wide open, rounded
      if (dict.viseme_oh !== undefined) infl[dict.viseme_oh] = Math.min(1, volume * 2.5)
      if (dict.viseme_ou !== undefined) infl[dict.viseme_ou] = Math.min(1, volume * 1.8)
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 1.2)
      break
      
    case 'open_front': // A sounds
      // Wide open, teeth visible
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 3.0)
      if (dict.viseme_oh !== undefined) infl[dict.viseme_oh] = Math.min(1, volume * 0.8)
      break
      
    case 'mid_front': // E sounds
      // Medium open, spread lips
      if (dict.viseme_ee !== undefined) infl[dict.viseme_ee] = Math.min(1, volume * 2.2)
      if (dict.viseme_ih !== undefined) infl[dict.viseme_ih] = Math.min(1, volume * 1.5)
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 0.6)
      break
      
    case 'mid_back': // O variants
      // Medium open, rounded
      if (dict.viseme_oh !== undefined) infl[dict.viseme_oh] = Math.min(1, volume * 2.0)
      if (dict.viseme_ou !== undefined) infl[dict.viseme_ou] = Math.min(1, volume * 1.5)
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 0.7)
      break
      
    case 'closed_front': // I, E sounds
      // Tight, spread lips
      if (dict.viseme_ee !== undefined) infl[dict.viseme_ee] = Math.min(1, volume * 2.5)
      if (dict.viseme_ih !== undefined) infl[dict.viseme_ih] = Math.min(1, volume * 2.0)
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 0.3)
      break
      
    case 'consonant_fricative': // F, S, TH, V, Z
      // Tight, forward
      if (dict.viseme_ee !== undefined) infl[dict.viseme_ee] = Math.min(1, volume * 1.5)
      if (dict.viseme_ih !== undefined) infl[dict.viseme_ih] = Math.min(1, volume * 1.2)
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 0.4)
      break
      
    case 'consonant_plosive': // P, B, T, D, K, G
      // Quick close then open
      if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * 2.0)
      if (dict.viseme_oh !== undefined) infl[dict.viseme_oh] = Math.min(1, volume * 1.5)
      break
      
    case 'vowel_mid':
    default:
      // Blend based on formant values
      const openness = Math.min(1, f1 / 800) // F1 determines openness
      const frontness = Math.min(1, (f2 - 1000) / 1500) // F2 determines front/back
      
      if (frontness > 0.5) {
        // Front vowels
        if (dict.viseme_ee !== undefined) infl[dict.viseme_ee] = Math.min(1, volume * openness * 2.0)
        if (dict.viseme_ih !== undefined) infl[dict.viseme_ih] = Math.min(1, volume * openness * 1.5)
      } else {
        // Back vowels
        if (dict.viseme_oh !== undefined) infl[dict.viseme_oh] = Math.min(1, volume * openness * 2.0)
        if (dict.viseme_ou !== undefined) infl[dict.viseme_ou] = Math.min(1, volume * openness * 1.5)
      }
      
      if (openness > 0.6) {
        // Open mouth
        if (dict.viseme_aa !== undefined) infl[dict.viseme_aa] = Math.min(1, volume * openness * 1.8)
      }
      break
  }
  
  // Ensure teeth visibility on loud sounds
  if (volume > 0.4) {
    const maxOpenness = Math.max(
      infl[dict.viseme_aa] || 0,
      infl[dict.viseme_oh] || 0,
      infl[dict.viseme_ou] || 0
    )
    if (maxOpenness > 0.3 && dict.viseme_aa !== undefined) {
      infl[dict.viseme_aa] = Math.max(infl[dict.viseme_aa] || 0, volume * 0.8)
    }
  }
  
  // Normalize to prevent exceeding 1.0
  let maxValue = 0
  for (let i = 0; i < infl.length; i++) {
    if (infl[i] > maxValue) maxValue = infl[i]
  }
  
  if (maxValue > 1.0) {
    for (let i = 0; i < infl.length; i++) {
      infl[i] = infl[i] / maxValue
    }
  }
}

