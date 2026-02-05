import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import * as THREE from 'three'

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

/**
 * Smoothly lerp morph target value (matching reference implementation)
 */
const lerpMorphTarget = (target, value, speed = 0.2) => {
  return (current, targetValue) => {
    return THREE.MathUtils.lerp(current, targetValue, speed)
  }
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
  useFrame(() => {
    // Lip sync animation is now handled directly in Avatar.jsx
    // This prevents conflicts and ensures proper timing after mixer.update()
    return
    const currentAudioTime = audioElement.currentTime || 0

    // Check if audio is playing
    if (audioElement.paused || audioElement.ended) {
      const silenceViseme = mapping.X || mapping.A
      if (silenceViseme) {
        const index = dict[silenceViseme]
        if (index !== undefined && index < infl.length) {
          infl[index] = THREE.MathUtils.lerp(infl[index] || 0, 1, 0.2)
        }
      }
      // Reset all other visemes
      Object.values(mapping).forEach((visemeName) => {
        if (visemeName !== silenceViseme) {
          const idx = dict[visemeName]
          if (idx !== undefined && idx < infl.length) {
            infl[idx] = THREE.MathUtils.lerp(infl[idx] || 0, 0, 0.1)
          }
        }
      })
      return
    }

    // Find current mouth cue based on audio time (matching reference implementation)
    const appliedMorphTargets = []
    let foundCue = null
    
    // CRITICAL: Create continuous pulsing/talking motion base while audio plays
    // This ensures mouth is ALWAYS visibly moving during speech!
    const pulseSpeed = 8.0 // Fast pulsing for talking effect
    const pulseValue = Math.abs(Math.sin(currentAudioTime * pulseSpeed)) // 0 to 1
    const baseMouthMovement = 3.0 + (pulseValue * 2.0) // Oscillate between 3.0 and 5.0
    const baseJawMovement = 4.0 + (pulseValue * 3.0) // Oscillate between 4.0 and 7.0
    
    // First, reset all visemes to 0
    Object.values(mapping).forEach((visemeName) => {
      const index = dict[visemeName]
      if (index !== undefined && index !== null && index >= 0 && index < infl.length) {
        infl[index] = 0
      }
    })
    
    // Apply BASE continuous mouth movement (this happens EVERY frame audio is playing!)
    if (dict.mouthOpen !== undefined) {
      infl[dict.mouthOpen] = baseMouthMovement
      appliedMorphTargets.push('mouthOpen')
    }
    if (dict.jawOpen !== undefined) {
      infl[dict.jawOpen] = baseJawMovement
      appliedMorphTargets.push('jawOpen')
    }
    
    // Log every frame to see if this is actually running
    if (Math.random() < 0.05) { // 5% of frames
      console.log(`🎬 CONTINUOUS MOUTH MOVEMENT - mouth: ${baseMouthMovement.toFixed(1)}, jaw: ${baseJawMovement.toFixed(1)}, time: ${currentAudioTime.toFixed(2)}s`)
    }
    
    for (let i = 0; i < mouthCuesRef.current.length; i++) {
      const mouthCue = mouthCuesRef.current[i]
      if (
        currentAudioTime >= mouthCue.start &&
        currentAudioTime <= mouthCue.end
      ) {
        foundCue = mouthCue
        
        // Log when cue changes
        if (lastCueRef.current !== mouthCue.value) {
          console.log(`👄 Cue changed: ${mouthCue.value} at ${currentAudioTime.toFixed(2)}s (${mouthCue.start}-${mouthCue.end}s)`)
          lastCueRef.current = mouthCue.value
        }
        
        const visemeName = mapping[mouthCue.value]
        if (visemeName) {
          const index = dict[visemeName]
          if (index !== undefined && index !== null && index >= 0 && index < infl.length) {
            appliedMorphTargets.push(visemeName)
            // Apply viseme - ADD to base movement for extra effect!
            infl[index] += 10.0 // Add viseme-specific movement on top of base
            
            // BOOST mouth opening even more during specific phonemes
            if (dict.mouthOpen !== undefined) {
              infl[dict.mouthOpen] += 8.0 // Add to base movement
            }
            
            // BOOST jaw drop even more during specific phonemes
            if (dict.jawOpen !== undefined) {
              infl[dict.jawOpen] += 10.0 // Add to base movement
            }
            
            // Add additional mouth movements for variety
            if (dict.mouthFunnel !== undefined) {
              infl[dict.mouthFunnel] += 5.0
              appliedMorphTargets.push('mouthFunnel')
            }
            
            // Mouth stretch for wide sounds
            if (dict.mouthStretchLeft !== undefined && ['B', 'C', 'E'].includes(mouthCue.value)) {
              infl[dict.mouthStretchLeft] += 6.0
              appliedMorphTargets.push('mouthStretchLeft')
            }
            if (dict.mouthStretchRight !== undefined && ['B', 'C', 'E'].includes(mouthCue.value)) {
              infl[dict.mouthStretchRight] += 6.0
              appliedMorphTargets.push('mouthStretchRight')
            }
            
            // Jaw forward for more movement
            if (dict.jawForward !== undefined) {
              infl[dict.jawForward] += 4.0
              appliedMorphTargets.push('jawForward')
            }
            
            // Debug: log when applying visemes (more frequently)
            if (lastCueRef.current === mouthCue.value) {
              console.log(`👄 EXTREME MOVEMENT - Applying viseme "${visemeName}" (${mouthCue.value}) at index ${index}, value: ${infl[index].toFixed(1)}`)
              if (dict.mouthOpen !== undefined && infl[dict.mouthOpen] > 0) {
                console.log(`   + mouthOpen: ${infl[dict.mouthOpen].toFixed(1)} (WIDE OPEN!)`)
              }
              if (dict.jawOpen !== undefined && infl[dict.jawOpen] > 0) {
                console.log(`   + jawOpen: ${infl[dict.jawOpen].toFixed(1)} (MASSIVE JAW DROP!)`)
              }
            }
          } else {
            if (lastCueRef.current === mouthCue.value) {
              // Only log once per cue change
              console.warn(`⚠️ Viseme "${visemeName}" (${mouthCue.value}) index ${index} invalid or out of range`)
              console.warn(`  Index: ${index}, Influences length: ${infl.length}`)
              console.warn(`  Available targets: ${Object.keys(dict).slice(0, 10).join(', ')}...`)
            }
          }
        } else {
          if (lastCueRef.current === mouthCue.value) {
            console.warn(`⚠️ No mapping found for mouth cue value: "${mouthCue.value}"`)
            console.warn(`  Current mapping keys: ${Object.keys(mapping).join(', ')}`)
            console.warn(`  Available cue values: ${[...new Set(mouthCuesRef.current.map(c => c.value))].join(', ')}`)
          }
        }
        break // Found the current cue
      }
    }
    
    // If no cue found but audio is playing, ADD extra default mouth shape
    if (!foundCue && currentAudioTime > 0 && !audioElement.paused && !audioElement.ended) {
      const defaultViseme = mapping.A || mapping.X
      if (defaultViseme) {
        const index = dict[defaultViseme]
        if (index !== undefined && index !== null && index >= 0 && index < infl.length) {
          infl[index] += 8.0 // ADD default viseme to base movement
          appliedMorphTargets.push(defaultViseme)
        }
      }
    }
    
    // Log what we're applying
    console.log(`👄 Frame ${Date.now() % 1000} - Applied targets:`, appliedMorphTargets.join(', '))
    if (dict.mouthOpen !== undefined) {
      console.log(`   mouthOpen value: ${infl[dict.mouthOpen].toFixed(2)}`)
    }
    if (dict.jawOpen !== undefined) {
      console.log(`   jawOpen value: ${infl[dict.jawOpen].toFixed(2)}`)
    }
    
    // Reset all other visemes that weren't applied - already reset above, but ensure they're 0
    Object.values(mapping).forEach((visemeName) => {
      if (!appliedMorphTargets.includes(visemeName)) {
        const index = dict[visemeName]
        if (index !== undefined && index !== null && index >= 0 && index < infl.length) {
          infl[index] = 0 // Direct reset to 0 for immediate response
        }
      }
    })
    
    // Force update the mesh morph targets - critical for changes to be visible
    if (mesh.updateMorphTargets) {
      mesh.updateMorphTargets()
    }
    
    // Mark geometry for update if needed
    if (mesh.geometry) {
      if (mesh.geometry.morphAttributes && mesh.geometry.morphAttributes.position) {
        mesh.geometry.morphAttributes.position.forEach(attr => {
          if (attr.needsUpdate !== undefined) {
            attr.needsUpdate = true
          }
        })
      }
      if (mesh.geometry.attributes && mesh.geometry.attributes.position) {
        mesh.geometry.attributes.position.needsUpdate = true
      }
    }
    
    // CRITICAL: Apply same morph targets to ALL additional mouth meshes for MAXIMUM effect!
    if (mesh.additionalLipSyncMeshes && mesh.additionalLipSyncMeshes.length > 0) {
      mesh.additionalLipSyncMeshes.forEach(additionalMesh => {
        if (!additionalMesh.morphTargetInfluences || !additionalMesh.morphTargetDictionary) {
          return
        }
        
        const additionalDict = additionalMesh.morphTargetDictionary
        const additionalInfl = additionalMesh.morphTargetInfluences
        
        // Copy all morph target values from primary mesh to additional meshes
        Object.entries(dict).forEach(([name, primaryIndex]) => {
          const additionalIndex = additionalDict[name]
          if (additionalIndex !== undefined && primaryIndex < infl.length && additionalIndex < additionalInfl.length) {
            // Copy the value from primary mesh
            additionalInfl[additionalIndex] = infl[primaryIndex]
          }
        })
        
        // Force update additional mesh
        if (additionalMesh.updateMorphTargets) {
          additionalMesh.updateMorphTargets()
        }
        if (additionalMesh.geometry && additionalMesh.geometry.attributes && additionalMesh.geometry.attributes.position) {
          additionalMesh.geometry.attributes.position.needsUpdate = true
        }
      })
    }
    
    // Debug: Log active visemes occasionally
    if (Math.random() < 0.02) { // ~2% chance per frame
      const activeVisemes = Object.entries(mapping)
        .filter(([key, visemeName]) => {
          const index = dict[visemeName]
          return index !== undefined && index !== null && index >= 0 && index < infl.length && infl[index] > 0.1
        })
        .map(([key, visemeName]) => `${key}(${visemeName}:${infl[dict[visemeName]].toFixed(2)})`)
      
      if (activeVisemes.length > 0) {
        console.log(`👄 Active visemes: ${activeVisemes.join(', ')} | Audio time: ${currentAudioTime.toFixed(2)}s`)
      } else if (currentAudioTime > 0 && !audioElement.paused) {
        console.log(`👄 No active visemes at ${currentAudioTime.toFixed(2)}s - audio playing but no morph targets applied`)
      }
    }
    
    // If no cue found but audio is playing, log for debugging
    if (!foundCue && currentAudioTime > 0) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.005) { // 0.5% chance per frame
        console.warn(`⚠️ No cue found for audio time ${currentAudioTime.toFixed(2)}s. Cues range: ${mouthCuesRef.current[0]?.start || 0}-${mouthCuesRef.current[mouthCuesRef.current.length - 1]?.end || 0}`)
      }
    }
  })
}
