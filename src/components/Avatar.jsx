import { useGLTF } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Avatar() {
    const { scene, animations } = useGLTF('/models/avtarr.glb')

    const headRef = useRef()
    const groupRef = useRef()
    const mixerRef = useRef(null)
    const avatarSkeletonRef = useRef(null)
    const { animationType, audioElement, lipSyncData, setMorphTargetDictionary, getAmplitude } = useLipSyncContext()

    // Facial expression refs
    const nextBlinkTimeRef = useRef(0)
    const blinkProgressRef = useRef(0)
    const isBlinkingRef = useRef(false)
    const prevCueRef = useRef(null)

    // Bone-based micro-motion refs
    const headBoneRef = useRef(null)
    const spineBoneRef = useRef(null)
    const neckBoneRef = useRef(null)

    // Store initial bone rotations
    const initialBoneRotations = useRef({})

    // Jaw bounce physics
    const prevJawOpenRef = useRef(0)

    useEffect(() => {
        const meshesWithMorphs = []

        scene.traverse((obj) => {
            const hasMorphTargets = obj.morphTargetDictionary && Object.keys(obj.morphTargetDictionary).length > 0

            if ((obj.isSkinnedMesh || obj.isMesh) && hasMorphTargets) {
                meshesWithMorphs.push({
                    mesh: obj,
                    name: obj.name,
                    morphCount: Object.keys(obj.morphTargetDictionary).length,
                    type: obj.isSkinnedMesh ? 'SkinnedMesh' : 'Mesh'
                })

                if (obj.isSkinnedMesh && obj.skeleton && !avatarSkeletonRef.current) {
                    avatarSkeletonRef.current = obj.skeleton
                }
            }
        })

        // Select mesh with best viseme support
        let selectedMesh = null
        const mouthMeshes = meshesWithMorphs.filter(m => {
            const lowerName = m.name.toLowerCase()
            return lowerName.includes('head') || lowerName.includes('teeth') ||
                   lowerName.includes('tongue') || lowerName.includes('face')
        })

        const headMesh = mouthMeshes.find(m => m.name.toLowerCase().includes('head'))

        if (headMesh) {
            selectedMesh = headMesh.mesh
            selectedMesh.additionalLipSyncMeshes = mouthMeshes
                .filter(m => m.name !== headMesh.name)
                .map(m => m.mesh)
        } else if (mouthMeshes.length > 0) {
            selectedMesh = mouthMeshes[0].mesh
            selectedMesh.additionalLipSyncMeshes = mouthMeshes.slice(1).map(m => m.mesh)
        } else if (meshesWithMorphs.length > 0) {
            selectedMesh = meshesWithMorphs[0].mesh
            selectedMesh.additionalLipSyncMeshes = []
        }

        if (selectedMesh) {
            headRef.current = selectedMesh

            const dictKeys = Object.keys(selectedMesh.morphTargetDictionary)
            const hasNumericKeys = dictKeys.length > 0 && !isNaN(dictKeys[0])

            if (hasNumericKeys) {
                let names = null
                if (selectedMesh.geometry?.userData?.targetNames) {
                    names = selectedMesh.geometry.userData.targetNames
                } else if (selectedMesh.userData?.targetNames) {
                    names = selectedMesh.userData.targetNames
                } else if (selectedMesh.parent?.userData?.targetNames) {
                    names = selectedMesh.parent.userData.targetNames
                }

                if (names && Array.isArray(names) && names.length > 0) {
                    const newDict = {}
                    names.forEach((name, index) => { newDict[name] = index })
                    selectedMesh.morphTargetDictionary = newDict
                    setMorphTargetDictionary({ ...newDict })
                }
            } else {
                setMorphTargetDictionary({ ...selectedMesh.morphTargetDictionary })
            }

            if (!selectedMesh.morphTargetInfluences) {
                const morphCount = Object.keys(selectedMesh.morphTargetDictionary).length
                selectedMesh.morphTargetInfluences = new Array(morphCount).fill(0)
            }
        }

        // Create animation mixer and play default animation
        mixerRef.current = new THREE.AnimationMixer(scene)

        if (animations && animations.length > 0) {
            let defaultClip = animations[0]

            // Remove morph target tracks to allow lip sync control
            const filteredTracks = defaultClip.tracks.filter(track => {
                return !(track.name && (
                    track.name.includes('.morphTargetInfluences') ||
                    track.name.toLowerCase().includes('viseme') ||
                    track.name.toLowerCase().includes('mouth') ||
                    track.name.toLowerCase().includes('jaw')
                ))
            })

            if (filteredTracks.length < defaultClip.tracks.length) {
                defaultClip = new THREE.AnimationClip(defaultClip.name, defaultClip.duration, filteredTracks)
            }

            const defaultAction = mixerRef.current.clipAction(defaultClip)
            defaultAction.setLoop(THREE.LoopRepeat, Infinity)
            defaultAction.setEffectiveWeight(1.0)
            defaultAction.play()
        }
    }, [scene])

    // Find bones for micro-motion
    useEffect(() => {
        if (!avatarSkeletonRef.current) return
        const bones = avatarSkeletonRef.current.bones
        for (const bone of bones) {
            const name = bone.name.toLowerCase()
            if (name.includes('head') && !name.includes('end')) headBoneRef.current = bone
            if ((name.includes('spine1') || name.includes('spine2')) && !spineBoneRef.current) spineBoneRef.current = bone
            if (name.includes('neck') && !name.includes('end')) neckBoneRef.current = bone
        }
        if (headBoneRef.current) {
            initialBoneRotations.current.head = {
                x: headBoneRef.current.rotation.x,
                y: headBoneRef.current.rotation.y,
                z: headBoneRef.current.rotation.z
            }
        }
        if (spineBoneRef.current) {
            initialBoneRotations.current.spineY = spineBoneRef.current.position.y
        }
        if (neckBoneRef.current) {
            initialBoneRotations.current.neck = { z: neckBoneRef.current.rotation.z }
        }
    }, [scene])

    useFrame((state, delta) => {
        if (mixerRef.current) {
            mixerRef.current.update(Math.min(delta, 0.1))
        }

        const elapsedTime = state.clock.elapsedTime
        const isAudioPlaying = audioElement && !audioElement.paused && !audioElement.ended
        const hasLipSyncData = lipSyncData && lipSyncData.mouthCues && lipSyncData.mouthCues.length > 0
        const amplitude = isAudioPlaying ? getAmplitude() : 0

        // ===== HELPER: apply morph target across all face meshes =====
        const applyMorph = (morphName, targetValue, speed) => {
            scene.traverse((obj) => {
                const meshName = (obj.name || '').toLowerCase()
                const isFaceMesh = meshName.includes('head') || meshName.includes('teeth') ||
                                   meshName.includes('tongue') || meshName.includes('face')
                if (!isFaceMesh) return
                if (!(obj.isSkinnedMesh || obj.isMesh) || !obj.morphTargetInfluences) return

                const dict = obj.morphTargetDictionary || {}
                const infl = obj.morphTargetInfluences
                const idx = dict[morphName]
                if (idx !== undefined && idx < infl.length) {
                    infl[idx] = infl[idx] + (targetValue - infl[idx]) * speed
                }
            })
        }

        // ===== BONE-BASED MICRO-MOTIONS =====

        // Breathing
        if (spineBoneRef.current && initialBoneRotations.current.spineY !== undefined) {
            const breathCycle = Math.sin(elapsedTime * 0.4 * Math.PI * 2)
            spineBoneRef.current.position.y = initialBoneRotations.current.spineY + breathCycle * 0.0006
        }

        // Head sway — reduced amplitude for more steady eye contact
        if (headBoneRef.current && initialBoneRotations.current.head) {
            const base = initialBoneRotations.current.head
            const headSwayX = Math.sin(elapsedTime * 0.25) * 0.006 + Math.sin(elapsedTime * 0.6) * 0.003
            const headSwayY = Math.sin(elapsedTime * 0.2 + 1.0) * 0.005 + Math.sin(elapsedTime * 0.5 + 0.5) * 0.002
            const headSwayZ = Math.sin(elapsedTime * 0.15 + 2.0) * 0.002

            headBoneRef.current.rotation.x = base.x + headSwayX
            headBoneRef.current.rotation.y = base.y + headSwayY
            headBoneRef.current.rotation.z = base.z + headSwayZ
        }

        // Shoulder micro-shift
        if (neckBoneRef.current && initialBoneRotations.current.neck) {
            const shoulderShift = Math.sin(elapsedTime * 0.35 + 1.5) * 0.002
            neckBoneRef.current.rotation.z = initialBoneRotations.current.neck.z + shoulderShift
        }

        // ===== BLINKING (always active) =====
        if (elapsedTime >= nextBlinkTimeRef.current) {
            if (!isBlinkingRef.current) {
                isBlinkingRef.current = true
                blinkProgressRef.current = 0
            }
        }

        if (isBlinkingRef.current) {
            blinkProgressRef.current += delta
            const blinkDuration = 0.15
            const halfBlink = blinkDuration / 2

            let blinkValue = 0
            if (blinkProgressRef.current < halfBlink) {
                blinkValue = blinkProgressRef.current / halfBlink
            } else if (blinkProgressRef.current < blinkDuration) {
                blinkValue = 1 - ((blinkProgressRef.current - halfBlink) / (halfBlink * 1.2))
            }

            blinkValue = Math.max(0, Math.min(1, blinkValue))
            applyMorph('eyeBlinkLeft', blinkValue, 0.6)
            applyMorph('eyeBlinkRight', blinkValue, 0.6)

            if (blinkProgressRef.current >= blinkDuration) {
                isBlinkingRef.current = false
                blinkProgressRef.current = 0
                const isDoubleBlink = Math.random() < 0.2
                nextBlinkTimeRef.current = elapsedTime + (isDoubleBlink ? 0.25 : (2 + Math.random() * 4))
            }
        } else {
            applyMorph('eyeBlinkLeft', 0, 0.3)
            applyMorph('eyeBlinkRight', 0, 0.3)
        }

        // ===== EYES LOOK FORWARD (camera) — no saccades =====
        const eyeSpeed = 0.15
        applyMorph('eyeLookOutLeft', 0, eyeSpeed)
        applyMorph('eyeLookInRight', 0, eyeSpeed)
        applyMorph('eyeLookInLeft', 0, eyeSpeed)
        applyMorph('eyeLookOutRight', 0, eyeSpeed)
        applyMorph('eyeLookUpLeft', 0, eyeSpeed)
        applyMorph('eyeLookUpRight', 0, eyeSpeed)
        applyMorph('eyeLookDownLeft', 0, eyeSpeed)
        applyMorph('eyeLookDownRight', 0, eyeSpeed)

        // ===== LIP SYNC WHILE SPEAKING =====
        if (isAudioPlaying) {
            const currentTime = audioElement.currentTime || 0

            let currentCue = null
            if (hasLipSyncData) {
                const mouthCues = lipSyncData.mouthCues
                for (let i = 0; i < mouthCues.length; i++) {
                    if (currentTime >= mouthCues[i].start && currentTime <= mouthCues[i].end) {
                        currentCue = mouthCues[i]
                        break
                    }
                }
            }

            const ampMod = 0.6 + amplitude * 0.5

            scene.traverse((obj) => {
                const meshName = (obj.name || '').toLowerCase()
                const isMouthMesh = meshName.includes('head') || meshName.includes('teeth') ||
                                    meshName.includes('tongue') || meshName.includes('face')
                const isEyeMesh = meshName.includes('eye') || meshName.includes('lash')
                if (isEyeMesh || !isMouthMesh) return

                if ((obj.isSkinnedMesh || obj.isMesh) && obj.morphTargetInfluences && obj.morphTargetInfluences.length > 0) {
                    const infl = obj.morphTargetInfluences
                    const dict = obj.morphTargetDictionary || {}
                    const hasStringKeys = Object.keys(dict).some(k => isNaN(k))

                    const getIdx = (name, fallback) => {
                        if (hasStringKeys && dict[name] !== undefined) return dict[name]
                        return fallback < infl.length ? fallback : undefined
                    }

                    const mouthOpenIdx = getIdx('mouthOpen', 0)
                    const jawOpenIdx = getIdx('jawOpen', 49)
                    const visemePPIdx = getIdx('viseme_PP', 2)
                    const visemeFFIdx = getIdx('viseme_FF', 3)
                    const visemeTHIdx = getIdx('viseme_TH', 4)
                    const visemeOIdx = getIdx('viseme_O', 65)
                    const visemeEIdx = getIdx('viseme_E', 63)
                    const visemeAAIdx = getIdx('viseme_aa', 62)
                    const visemeIIdx = getIdx('viseme_I', 64)
                    const visemeUIdx = getIdx('viseme_U', 66)
                    const visemeKKIdx = getIdx('viseme_kk', 57)
                    const visemeCHIdx = getIdx('viseme_CH', 58)
                    const visemeSSIdx = getIdx('viseme_SS', 59)
                    const visemeNNIdx = getIdx('viseme_nn', 60)
                    const visemeRRIdx = getIdx('viseme_RR', 61)
                    const visemeDDIdx = getIdx('viseme_DD', 56)

                    let targets = {
                        mouthOpen: 0, jaw: 0, PP: 0, FF: 0, TH: 0, O: 0, E: 0,
                        AA: 0, I: 0, U: 0, KK: 0, CH: 0, SS: 0, NN: 0, RR: 0, DD: 0
                    }

                    if (currentCue) {
                        switch (currentCue.value) {
                            case 'A':
                                targets.mouthOpen = 0.45; targets.jaw = 0.4; targets.AA = 0.55
                                break
                            case 'B':
                                targets.mouthOpen = 0.05; targets.jaw = 0.05; targets.PP = 0.65
                                break
                            case 'C':
                                targets.mouthOpen = 0.3; targets.jaw = 0.18; targets.E = 0.45
                                break
                            case 'D':
                                targets.mouthOpen = 0.4; targets.jaw = 0.35; targets.AA = 0.5; targets.DD = 0.35
                                break
                            case 'E':
                                targets.mouthOpen = 0.18; targets.jaw = 0.12; targets.E = 0.55; targets.I = 0.35
                                break
                            case 'F':
                                targets.mouthOpen = 0.12; targets.jaw = 0.1; targets.FF = 0.65
                                break
                            case 'G':
                                targets.mouthOpen = 0.35; targets.jaw = 0.3; targets.O = 0.55; targets.U = 0.25
                                break
                            case 'H':
                                targets.mouthOpen = 0.22; targets.jaw = 0.18; targets.TH = 0.35; targets.NN = 0.25
                                break
                            case 'X':
                            default:
                                targets.mouthOpen = 0.02; targets.jaw = 0.01
                                break
                        }

                        targets.mouthOpen *= ampMod
                        targets.jaw *= ampMod
                        prevCueRef.current = currentCue.value
                    } else {
                        // Fallback: amplitude-based mouth movement
                        const wave1 = Math.sin(currentTime * 10) * 0.5 + 0.5
                        const wave2 = Math.sin(currentTime * 15) * 0.5 + 0.5
                        const phase = (currentTime * 3) % 4

                        if (phase < 1) {
                            targets.mouthOpen = (0.2 + wave1 * 0.15) * ampMod
                            targets.jaw = (0.15 + wave2 * 0.1) * ampMod
                            targets.AA = 0.3 * wave1
                        } else if (phase < 2) {
                            targets.mouthOpen = (0.15 + wave2 * 0.1) * ampMod
                            targets.E = 0.35 * wave2
                        } else if (phase < 3) {
                            targets.mouthOpen = (0.2 + wave1 * 0.1) * ampMod
                            targets.O = 0.3 * wave1
                        } else {
                            targets.mouthOpen = (0.1 + wave1 * 0.15) * ampMod
                            targets.jaw = 0.1 * wave1
                        }
                    }

                    // Smoother interpolation — faster open, gradual close, no overshoot
                    const applySmooth = (idx, target) => {
                        if (idx !== undefined && idx < infl.length) {
                            const current = infl[idx] || 0
                            const diff = target - current
                            const speed = diff > 0 ? 0.35 : 0.18
                            infl[idx] = Math.max(0, Math.min(1, current + diff * speed))
                        }
                    }

                    applySmooth(mouthOpenIdx, targets.mouthOpen)
                    applySmooth(jawOpenIdx, targets.jaw)
                    applySmooth(visemePPIdx, targets.PP)
                    applySmooth(visemeFFIdx, targets.FF)
                    applySmooth(visemeTHIdx, targets.TH)
                    applySmooth(visemeOIdx, targets.O)
                    applySmooth(visemeEIdx, targets.E)
                    applySmooth(visemeAAIdx, targets.AA)
                    applySmooth(visemeIIdx, targets.I)
                    applySmooth(visemeUIdx, targets.U)
                    applySmooth(visemeKKIdx, targets.KK)
                    applySmooth(visemeCHIdx, targets.CH)
                    applySmooth(visemeSSIdx, targets.SS)
                    applySmooth(visemeNNIdx, targets.NN)
                    applySmooth(visemeRRIdx, targets.RR)
                    applySmooth(visemeDDIdx, targets.DD)
                }
            })

            // Eyebrow movements during speech
            if (currentCue) {
                const phoneme = currentCue.value
                if (['A', 'D', 'G'].includes(phoneme)) {
                    applyMorph('browInnerUp', 0.25 * ampMod, 0.1)
                    applyMorph('browOuterUpLeft', 0.18 * ampMod, 0.1)
                    applyMorph('browOuterUpRight', 0.18 * ampMod, 0.1)
                    applyMorph('browDownLeft', 0, 0.08)
                    applyMorph('browDownRight', 0, 0.08)
                } else if (['B', 'F'].includes(phoneme)) {
                    applyMorph('browDownLeft', 0.12, 0.08)
                    applyMorph('browDownRight', 0.12, 0.08)
                    applyMorph('browInnerUp', 0, 0.08)
                } else {
                    applyMorph('browInnerUp', 0.03, 0.06)
                    applyMorph('browDownLeft', 0, 0.06)
                    applyMorph('browDownRight', 0, 0.06)
                }
            }

            // Subtle smile while speaking
            applyMorph('mouthSmileLeft', 0.1 + amplitude * 0.06, 0.06)
            applyMorph('mouthSmileRight', 0.1 + amplitude * 0.06, 0.06)
            applyMorph('cheekSquintLeft', 0.05 + amplitude * 0.03, 0.06)
            applyMorph('cheekSquintRight', 0.05 + amplitude * 0.03, 0.06)

        } else {
            // ===== IDLE STATE =====
            prevCueRef.current = null

            scene.traverse((obj) => {
                const meshName = (obj.name || '').toLowerCase()
                const isMouthMesh = meshName.includes('head') || meshName.includes('teeth') ||
                                    meshName.includes('tongue') || meshName.includes('face')
                const isEyeMesh = meshName.includes('eye') || meshName.includes('lash')
                if (isEyeMesh || !isMouthMesh) return

                if ((obj.isSkinnedMesh || obj.isMesh) && obj.morphTargetInfluences && obj.morphTargetInfluences.length > 0) {
                    const infl = obj.morphTargetInfluences
                    const dict = obj.morphTargetDictionary || {}
                    const hasStringKeys = Object.keys(dict).some(k => isNaN(k))

                    const mouthIndices = []
                    if (hasStringKeys) {
                        Object.entries(dict).forEach(([name, idx]) => {
                            const lowerName = name.toLowerCase()
                            if (lowerName.includes('mouth') || lowerName.includes('viseme') ||
                                lowerName.includes('jaw') || lowerName.includes('lip') ||
                                lowerName.includes('tongue')) {
                                mouthIndices.push(idx)
                            }
                        })
                    } else {
                        for (let i = 0; i < Math.min(infl.length, 20); i++) {
                            mouthIndices.push(i)
                        }
                    }

                    mouthIndices.forEach(i => {
                        if (i < infl.length && infl[i] > 0.001) {
                            infl[i] = infl[i] * 0.85
                        }
                    })
                }
            })

            // Subtle breathing jaw
            const breathValue = (Math.sin(elapsedTime * 1.5) * 0.5 + 0.5) * 0.015
            applyMorph('jawOpen', breathValue, 0.1)

            // Slight idle squint
            const squintWave = (Math.sin(elapsedTime * 0.7) * 0.5 + 0.5) * 0.03
            applyMorph('eyeSquintLeft', squintWave, 0.05)
            applyMorph('eyeSquintRight', squintWave, 0.05)

            // Reset expression morphs
            applyMorph('browInnerUp', 0, 0.04)
            applyMorph('browOuterUpLeft', 0, 0.04)
            applyMorph('browOuterUpRight', 0, 0.04)
            applyMorph('browDownLeft', 0, 0.04)
            applyMorph('browDownRight', 0, 0.04)
            applyMorph('mouthSmileLeft', 0, 0.04)
            applyMorph('mouthSmileRight', 0, 0.04)
            applyMorph('cheekSquintLeft', 0, 0.04)
            applyMorph('cheekSquintRight', 0, 0.04)
        }
    })

    return (
        <group ref={groupRef} position={[-0.5, -0.5, -2]}>
            <primitive
                object={scene}
                scale={1.5}
                position={[0, 0, 0]}
            />
        </group>
    )
}

useGLTF.preload('/models/avtarr.glb')
