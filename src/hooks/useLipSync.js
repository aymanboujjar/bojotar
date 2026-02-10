import { useRef, useEffect } from 'react'
import { useLipSyncContext } from '../contexts/LipSyncContext'

// Mapping from Rhubarb mouth shapes to viseme names (matching reference implementation)
// Use exact names that match your avatar: viseme_aa (lowercase) is common in many models
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk",
  C: "viseme_I",
  D: "viseme_aa",  // model has viseme_aa (lowercase), not viseme_AA
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_PP",
}

/**
 * Resolve mapping to use exact keys from the mesh's morphTargetDictionary (case-insensitive match)
 */
function resolveMappingToDict(mapping, dict) {
  const allTargets = Object.keys(dict)
  const resolved = {}
  for (const [rhubarbKey, visemeName] of Object.entries(mapping)) {
    if (dict[visemeName] !== undefined) {
      resolved[rhubarbKey] = visemeName
    } else {
      const found = allTargets.find(t => t.toLowerCase() === visemeName.toLowerCase())
      resolved[rhubarbKey] = found != null ? found : visemeName
    }
  }
  return resolved
}

export function useLipSync(headRef) {
  const { lipSyncData, audioElement, morphTargetDictionary } = useLipSyncContext()
  const mouthCuesRef = useRef([])
  const lastCueRef = useRef(null)
  const detectedMappingRef = useRef(null)
  const cachedDictionaryRef = useRef(null) // Cache the correct dictionary to prevent resets

  useEffect(() => {
    if (lipSyncData && lipSyncData.mouthCues) {
      mouthCuesRef.current = lipSyncData.mouthCues
      console.log('✅ Lip sync cues loaded:', mouthCuesRef.current.length, 'cues')
      console.log('📋 Sample cues:', mouthCuesRef.current.slice(0, 5))
    } else {
      mouthCuesRef.current = []
      console.log('⚠️ No lip sync cues available')
    }
  }, [lipSyncData])

  // Debug audio element changes
  useEffect(() => {
    if (audioElement) {
      console.log('🔊 Audio element set for lip sync:', {
        src: audioElement.src?.substring(0, 50) || 'N/A',
        duration: audioElement.duration || 'N/A',
        paused: audioElement.paused,
        readyState: audioElement.readyState
      })
    } else {
      console.log('⚠️ No audio element set for lip sync')
    }
  }, [audioElement])

  // Detect available viseme morph targets
  useEffect(() => {
    // Use a small delay to ensure the mesh is fully loaded
    const checkMesh = () => {
      if (!headRef.current) {
        console.log('⏳ Waiting for head mesh...')
        return false
      }

      const mesh = headRef.current
      
      // Use dictionary from context (Avatar.jsx stores it there before mixer corrupts it)
      if (!morphTargetDictionary) {
        console.log('⏳ Waiting for morphTargetDictionary from context...')
        return false
      }

      // Ensure morphTargetInfluences exists
      if (!mesh.morphTargetInfluences) {
        console.warn('⚠️ No morphTargetInfluences found, initializing...')
        const morphCount = Object.keys(morphTargetDictionary).length
        mesh.morphTargetInfluences = new Array(morphCount).fill(0)
      }

      // Use the dictionary from context (it has proper string names)
      const dict = morphTargetDictionary
      const allTargets = Object.keys(dict)
      
      console.log('🔍 Dictionary keys from context:', allTargets.slice(0, 10))
      console.log('📊 Total morph targets:', allTargets.length)
      
      // Try to find which mapping works
      let workingMapping = null
      
      // Try the standard mapping first
      const testKeys = Object.values(corresponding)
      const hasStandardMapping = testKeys.some(key => dict[key] !== undefined)
      
      if (hasStandardMapping) {
        workingMapping = resolveMappingToDict(corresponding, dict)
        console.log('✅ Using standard viseme mapping (resolved to mesh keys):', workingMapping)
      } else {
        // Try alternative mappings
        const alternatives = [
          {
            A: "viseme_sil", B: "viseme_oh", C: "viseme_ou", D: "viseme_aa",
            E: "viseme_ih", F: "viseme_ff", G: "viseme_th", H: "viseme_kk", X: "viseme_sil"
          },
          {
            A: "viseme_X", B: "viseme_B", C: "viseme_C", D: "viseme_D",
            E: "viseme_E", F: "viseme_F", G: "viseme_G", H: "viseme_H", X: "viseme_X"
          },
          // Try lowercase variations
          {
            A: "viseme_pp", B: "viseme_kk", C: "viseme_i", D: "viseme_aa",
            E: "viseme_o", F: "viseme_u", G: "viseme_ff", H: "viseme_th", X: "viseme_pp"
          },
          // Try without viseme prefix
          {
            A: "PP", B: "kk", C: "I", D: "AA",
            E: "O", F: "U", G: "FF", H: "TH", X: "PP"
          },
          {
            A: "pp", B: "kk", C: "i", D: "aa",
            E: "o", F: "u", G: "ff", H: "th", X: "pp"
          }
        ]
        
        for (const altMapping of alternatives) {
          const testKey = Object.values(altMapping)[0]
          if (dict[testKey] !== undefined) {
            workingMapping = altMapping
            console.log('✅ Using alternative viseme mapping:', testKey)
            break
          }
        }
        
        // If still no mapping, try to find any viseme-like targets
        if (!workingMapping) {
          const visemeTargets = allTargets.filter(k => 
            k.toLowerCase().includes('viseme') || 
            k.toLowerCase().includes('mouth') ||
            k.toLowerCase().includes('lip') ||
            k.toLowerCase().includes('phoneme')
          )
          
          if (visemeTargets.length > 0) {
            console.log('👄 Found viseme-like targets:', visemeTargets)
            // Create a simple mapping using available targets
            const autoMapping = {}
            const keys = Object.keys(corresponding)
            
            // Try to match by name similarity
            keys.forEach(key => {
              const targetName = corresponding[key]
              // Try exact match first
              if (dict[targetName] !== undefined) {
                autoMapping[key] = targetName
              } else {
                // Try to find similar name
                const similar = visemeTargets.find(t => 
                  t.toLowerCase().includes(targetName.toLowerCase().replace('viseme_', '')) ||
                  targetName.toLowerCase().replace('viseme_', '').includes(t.toLowerCase())
                )
                if (similar) {
                  autoMapping[key] = similar
                }
              }
            })
            
            // Fill remaining with available targets
            let targetIndex = 0
            keys.forEach(key => {
              if (!autoMapping[key] && targetIndex < visemeTargets.length) {
                autoMapping[key] = visemeTargets[targetIndex++]
              }
            })
            
            if (Object.keys(autoMapping).length > 0) {
              workingMapping = autoMapping
              console.log('✅ Using auto-detected mapping:', autoMapping)
            }
          } else {
            // Last resort: use any morph targets we can find
            console.log('⚠️ No viseme-like targets found, trying to use any available morph targets')
            if (allTargets.length > 0) {
              const fallbackMapping = {}
              const keys = Object.keys(corresponding)
              keys.forEach((key, idx) => {
                if (idx < allTargets.length) {
                  fallbackMapping[key] = allTargets[idx]
                }
              })
              if (Object.keys(fallbackMapping).length > 0) {
                workingMapping = fallbackMapping
                console.log('⚠️ Using fallback mapping (may not be accurate):', fallbackMapping)
              }
            }
          }
        }
      }
      
      if (workingMapping) {
        // Always resolve to exact keys in dictionary (fixes case mismatch e.g. viseme_AA vs viseme_aa)
        const resolved = resolveMappingToDict(workingMapping, dict)
        detectedMappingRef.current = resolved
        console.log('📋 Final viseme mapping (resolved):', resolved)
        
        // Verify all mapped targets exist
        const missing = []
        Object.values(resolved).forEach(target => {
          if (dict[target] === undefined) {
            missing.push(target)
          }
        })
        if (missing.length > 0) {
          console.warn('⚠️ Some mapped targets are missing:', missing)
        } else {
          console.log('✅ All mapped targets verified')
        }
        
        // CRITICAL FIX: Cache the correct dictionary since Three.js/mixer keeps resetting it to numeric keys
        // Create a frozen copy so it can't be mutated externally
        cachedDictionaryRef.current = { ...dict }
        console.log('💾 Cached correct dictionary with', Object.keys(cachedDictionaryRef.current).length, 'targets')
        
        return true
      } else {
        console.error('❌ Could not find any viseme mapping! Available targets:', allTargets)
        detectedMappingRef.current = resolveMappingToDict(corresponding, dict)
        // Still cache the dictionary
        cachedDictionaryRef.current = { ...dict }
        return true
      }
    }

    // Try immediately
    if (!checkMesh()) {
      // If not ready, try again with increasing delays
      let attempts = 0
      const maxAttempts = 10
      const tryAgain = () => {
        attempts++
        if (checkMesh() || attempts >= maxAttempts) {
          return
        }
        setTimeout(tryAgain, 100 * attempts) // Exponential backoff
      }
      const timeoutId = setTimeout(tryAgain, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [lipSyncData, headRef, morphTargetDictionary]) // Re-run when lip sync data, head ref, or dictionary changes

  // NOTE: Main lip sync animation is handled in Avatar.jsx useFrame
  // This hook only handles setup and caching of the dictionary
}
