import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import * as THREE from 'three'

// Mapping from Rhubarb mouth shapes to viseme names (matching reference implementation)
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk",
  C: "viseme_I",
  D: "viseme_AA",
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_PP",
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
  const { lipSyncData, audioElement } = useLipSyncContext()
  const mouthCuesRef = useRef([])
  const lastCueRef = useRef(null)
  const detectedMappingRef = useRef(null)

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
      if (!mesh.morphTargetDictionary) {
        console.warn('⚠️ No morphTargetDictionary found on mesh')
        return false
      }

      const dict = mesh.morphTargetDictionary
      const allTargets = Object.keys(dict)
      
      console.log('🔍 All available morph targets:', allTargets)
      
      // Try to find which mapping works
      let workingMapping = null
      
      // Try the standard mapping first
      const testKeys = Object.values(corresponding)
      const hasStandardMapping = testKeys.some(key => dict[key] !== undefined)
      
      if (hasStandardMapping) {
        workingMapping = corresponding
        console.log('✅ Using standard viseme mapping')
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
            k.toLowerCase().includes('lip')
          )
          
          if (visemeTargets.length > 0) {
            console.log('👄 Found viseme-like targets:', visemeTargets)
            // Create a simple mapping using available targets
            const autoMapping = {}
            const keys = Object.keys(corresponding)
            visemeTargets.forEach((target, idx) => {
              if (idx < keys.length) {
                autoMapping[keys[idx]] = target
              }
            })
            if (Object.keys(autoMapping).length > 0) {
              workingMapping = autoMapping
              console.log('✅ Using auto-detected mapping:', autoMapping)
            }
          }
        }
      }
      
      if (workingMapping) {
        detectedMappingRef.current = workingMapping
        console.log('📋 Final viseme mapping:', workingMapping)
        return true
      } else {
        console.error('❌ Could not find any viseme mapping! Available targets:', allTargets)
        detectedMappingRef.current = corresponding // Fallback to standard
        return true
      }
    }

    // Try immediately
    if (!checkMesh()) {
      // If not ready, try again after a short delay
      const timeoutId = setTimeout(() => {
        checkMesh()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [lipSyncData]) // Re-run when lip sync data changes

  useFrame(() => {
    if (!headRef.current) return

    const mesh = headRef.current
    
    if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) {
      return
    }

    const dict = mesh.morphTargetDictionary
    const infl = mesh.morphTargetInfluences
    const mapping = detectedMappingRef.current || corresponding

    // Debug logging (only log occasionally to avoid spam)
   

    // If no audio or no lip sync data, keep mouth closed
    if (!audioElement || !mouthCuesRef.current || mouthCuesRef.current.length === 0) {
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

    // Get current audio time
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
          if (index !== undefined && index < infl.length) {
            appliedMorphTargets.push(visemeName)
            // Apply viseme with stronger, faster transition for more visible movement
            const currentValue = infl[index] || 0
            const newValue = THREE.MathUtils.lerp(currentValue, 1, 0.5) // Increased speed and strength
            infl[index] = Math.max(0, Math.min(1, newValue)) // Clamp to 0-1
            
            // Debug: log when applying visemes (occasionally)
            if (lastCueRef.current !== mouthCue.value) {
              console.log(`👄 Applying viseme "${visemeName}" (${mouthCue.value}) at index ${index}, value: ${infl[index].toFixed(3)}`)
            }
          } else {
            if (lastCueRef.current === mouthCue.value) {
              // Only log once per cue change
              console.warn(`⚠️ Viseme "${visemeName}" (${mouthCue.value}) index ${index} invalid or out of range`)
              console.warn('Dictionary:', Object.keys(dict).slice(0, 20))
              console.warn('Influences length:', infl.length)
            }
          }
        } else {
          if (lastCueRef.current === mouthCue.value) {
            console.warn(`⚠️ No mapping found for mouth cue value: ${mouthCue.value}`)
            console.warn('Current mapping:', mapping)
            console.warn('Available cue values:', [...new Set(mouthCuesRef.current.map(c => c.value))])
          }
        }
        break // Found the current cue
      }
    }

    // Reset all other visemes that weren't applied (matching reference implementation)
    Object.values(mapping).forEach((visemeName) => {
      if (!appliedMorphTargets.includes(visemeName)) {
        const index = dict[visemeName]
        if (index !== undefined && index < infl.length) {
          const currentValue = infl[index] || 0
          infl[index] = THREE.MathUtils.lerp(currentValue, 0, 0.25) // Faster reset for more responsive movement
        }
      }
    })
    
    // If no cue found but audio is playing, log for debugging
    if (!foundCue && currentAudioTime > 0) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.005) { // 0.5% chance per frame
        console.warn(`⚠️ No cue found for audio time ${currentAudioTime.toFixed(2)}s. Cues range: ${mouthCuesRef.current[0]?.start || 0}-${mouthCuesRef.current[mouthCuesRef.current.length - 1]?.end || 0}`)
      }
    }
  })
}
