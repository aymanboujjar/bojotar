import { useGLTF, useFBX } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Avatar() {
    const { scene, animations } = useGLTF('/models/avtarr.glb')
    const walkFbx = useFBX('/models/animations/Walking.fbx')
    const leftTurnFbx = useFBX('/models/animations/Left Turn.fbx')
    const rightTurnFbx = useFBX('/models/animations/Right Turn.fbx')

    const headRef = useRef()
    const groupRef = useRef()
    const mixerRef = useRef(null)
    const avatarSkeletonRef = useRef(null)
    const { animationType, audioElement, lipSyncData, setMorphTargetDictionary, getAmplitude, currentEmotion, convState } = useLipSyncContext()

    // Facial expression refs
    const nextBlinkTimeRef = useRef(0)
    const blinkProgressRef = useRef(0)
    const isBlinkingRef = useRef(false)
    const prevCueRef = useRef(null)

    // Eye saccade refs (micro eye movements for realism)
    const nextSaccadeTimeRef = useRef(0)
    const saccadeTargetRef = useRef({ x: 0, y: 0 })
    const saccadeCurrentRef = useRef({ x: 0, y: 0 })

    // Emotion transition (smooth blending between emotions)
    const currentEmotionRef = useRef('neutral')
    const emotionBlendRef = useRef({})

    // Bone-based micro-motion refs
    const headBoneRef = useRef(null)
    const spineBoneRef = useRef(null)
    const neckBoneRef = useRef(null)

    // Store initial bone rotations
    const initialBoneRotations = useRef({})

    // Head nod tracking for speech emphasis
    const speechEmphasisRef = useRef(0)
    const prevAmplitudeRef = useRef(0)

    // Jaw bone for physical jaw movement
    const jawBoneRef = useRef(null)
    const initialJawRotation = useRef(null)

    // Smooth lip sync state — holds current interpolated morph values
    const smoothMorphsRef = useRef({})

    // Track current cue index for binary search optimization
    const lastCueIndexRef = useRef(0)

    // ===== WANDER SYSTEM REFS =====
    const idleActionRef = useRef(null)
    const walkActionRef = useRef(null)
    const turnLeftActionRef = useRef(null)
    const turnRightActionRef = useRef(null)
    const walkWeightRef = useRef(0) // 0=idle, 1=walk
    const walkWeightTargetRef = useRef(0)
    const turnWeightRef = useRef(0)
    const turnWeightTargetRef = useRef(0)
    const walkTimerRef = useRef(0) // caps how long a walk lasts
    const turnTimerRef = useRef(0) // elapsed time during turn animation
    const turnDurationRef = useRef(1) // duration of current turn clip
    const turnDirectionRef = useRef(null) // 'left' | 'right' when in TURNING

    // Wander state: IDLE_STANDING | TURNING | WALKING | STOPPING | CONVERSATION | RESUME_PAUSE
    const wanderStateRef = useRef('IDLE_STANDING')
    const wanderTimerRef = useRef(3 + Math.random() * 5)
    const wanderTargetRef = useRef({ x: 0, z: 0 })
    const facingAngleRef = useRef(Math.PI) // facing camera initially

    // Walkable area — center is fully open (no furniture)
    // Room at 1.5x: walls X=±7.5, back wall Z=-6, bookshelves on walls only
    // Keep avatar within the rug / open floor area
    const WALK_BOUNDS = { xMin: -3.5, xMax: 3.5, zMin: -3.5, zMax: 3.5 }

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

        // Filter morph tracks helper
        const filterMorphTracks = (clip) => {
            const filtered = clip.tracks.filter(track => {
                return !(track.name && (
                    track.name.includes('.morphTargetInfluences') ||
                    track.name.toLowerCase().includes('viseme') ||
                    track.name.toLowerCase().includes('mouth') ||
                    track.name.toLowerCase().includes('jaw')
                ))
            })
            if (filtered.length < clip.tracks.length) {
                return new THREE.AnimationClip(clip.name, clip.duration, filtered)
            }
            return clip
        }

        if (animations && animations.length > 0) {
            const idleClip = filterMorphTracks(animations[0])
            const idleAction = mixerRef.current.clipAction(idleClip)
            idleAction.setLoop(THREE.LoopRepeat, Infinity)
            idleAction.setEffectiveWeight(1.0)
            idleAction.play()
            idleActionRef.current = idleAction
        }

        // Strip any position tracks so the avatar stays at group position (no sinking)
        const stripPositionTracks = (clip) => {
            const kept = clip.tracks.filter(track => !track.name.includes('.position'))
            return kept.length < clip.tracks.length
                ? new THREE.AnimationClip(clip.name, clip.duration, kept)
                : clip
        }

        // Load FBX walk animation onto the same mixer
        if (walkFbx.animations && walkFbx.animations.length > 0) {
            let walkClip = filterMorphTracks(walkFbx.animations[0])
            walkClip = stripPositionTracks(walkClip)

            const walkAction = mixerRef.current.clipAction(walkClip)
            walkAction.setLoop(THREE.LoopRepeat, Infinity)
            walkAction.setEffectiveWeight(0)
            walkAction.play()
            walkActionRef.current = walkAction
        }

        // Load turn-left and turn-right FBX animations (play once, no loop)
        const setupTurnClip = (fbx, actionRef) => {
            if (!fbx.animations || fbx.animations.length === 0) return 0
            let clip = filterMorphTracks(fbx.animations[0])
            clip = stripPositionTracks(clip)
            const action = mixerRef.current.clipAction(clip)
            action.setLoop(THREE.LoopOnce)
            action.clampWhenFinished = true
            action.setEffectiveWeight(0)
            actionRef.current = action
            return clip.duration
        }
        if (leftTurnFbx.animations?.length) {
            turnDurationRef.current = setupTurnClip(leftTurnFbx, turnLeftActionRef)
        }
        if (rightTurnFbx.animations?.length) {
            const d = setupTurnClip(rightTurnFbx, turnRightActionRef)
            if (d > 0) turnDurationRef.current = d
        }
    }, [scene, walkFbx, leftTurnFbx, rightTurnFbx])

    // Find bones for micro-motion
    useEffect(() => {
        if (!avatarSkeletonRef.current) return
        const bones = avatarSkeletonRef.current.bones
        for (const bone of bones) {
            const name = bone.name.toLowerCase()
            if (name.includes('head') && !name.includes('end')) headBoneRef.current = bone
            if ((name.includes('spine1') || name.includes('spine2')) && !spineBoneRef.current) spineBoneRef.current = bone
            if (name.includes('neck') && !name.includes('end')) neckBoneRef.current = bone
            if (name.includes('jaw') && !name.includes('end')) jawBoneRef.current = bone
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
        if (jawBoneRef.current) {
            initialJawRotation.current = {
                x: jawBoneRef.current.rotation.x,
                y: jawBoneRef.current.rotation.y,
                z: jawBoneRef.current.rotation.z
            }
        }
    }, [scene])

    useFrame((state, delta) => {
        if (mixerRef.current) {
            mixerRef.current.update(Math.min(delta, 0.1))
        }

        // ===== WANDER STATE MACHINE + MOVEMENT =====
        const clampDelta = Math.min(delta, 0.1)
        const WALK_SPEED = 0.55
        const ROTATION_SPEED = 2.5
        const BLEND_SPEED = 2.5 // slower blend for smooth crossfade (no jarring loop restart)
        const MAX_WALK_TIME = 2.5 + Math.sin(walkTimerRef.current * 7) * 0.5 // 2-3 seconds
        const WALK_DIST = 1.4 // ~1.4 units = ~2.5s at 0.55 speed

        // Pick a nearby target — moderate distance from current position
        const pickNearbyTarget = () => {
            const pos = groupRef.current?.position
            if (!pos) return { x: 0, z: 1 }
            const angle = Math.random() * Math.PI * 2
            const dist = WALK_DIST + Math.random() * 0.5
            let tx = pos.x + Math.sin(angle) * dist
            let tz = pos.z + Math.cos(angle) * dist
            // Clamp to walkable bounds
            tx = Math.max(WALK_BOUNDS.xMin, Math.min(WALK_BOUNDS.xMax, tx))
            tz = Math.max(WALK_BOUNDS.zMin, Math.min(WALK_BOUNDS.zMax, tz))
            return { x: tx, z: tz }
        }

        const inConversation = convState !== 'idle'
        const ws = wanderStateRef.current

        // Transition to conversation states
        if (inConversation && ws !== 'CONVERSATION' && ws !== 'STOPPING') {
            wanderStateRef.current = 'STOPPING'
            walkWeightTargetRef.current = 0
        }

        // Transition out of conversation
        if (!inConversation && ws === 'CONVERSATION') {
            wanderStateRef.current = 'RESUME_PAUSE'
            wanderTimerRef.current = 2 + Math.random() * 2
        }

        // State machine tick
        switch (wanderStateRef.current) {
            case 'IDLE_STANDING': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 0
                wanderTimerRef.current -= clampDelta
                if (wanderTimerRef.current <= 0) {
                    wanderTargetRef.current = pickNearbyTarget()
                    wanderStateRef.current = 'TURNING'
                }
                break
            }
            case 'TURNING': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 1
                const pos = groupRef.current?.position
                if (!pos) break
                const dx = wanderTargetRef.current.x - pos.x
                const dz = wanderTargetRef.current.z - pos.z
                const targetAngle = Math.atan2(dx, dz)

                let angleDiff = targetAngle - facingAngleRef.current
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

                // Start turn animation on first frame of TURNING
                if (turnDirectionRef.current === null) {
                    turnDirectionRef.current = angleDiff > 0 ? 'left' : 'right'
                    const turnAction = turnDirectionRef.current === 'left' ? turnLeftActionRef.current : turnRightActionRef.current
                    if (turnAction) {
                        turnAction.reset()
                        turnAction.play()
                    }
                    turnTimerRef.current = 0
                }

                turnTimerRef.current += clampDelta

                if (turnTimerRef.current >= turnDurationRef.current) {
                    facingAngleRef.current = targetAngle
                    wanderStateRef.current = 'WALKING'
                    walkWeightTargetRef.current = 1
                    walkTimerRef.current = 0
                    turnWeightTargetRef.current = 0
                    turnDirectionRef.current = null
                } else {
                    facingAngleRef.current += Math.sign(angleDiff) * Math.min(ROTATION_SPEED * clampDelta, Math.abs(angleDiff))
                }
                break
            }
            case 'WALKING': {
                walkWeightTargetRef.current = 1
                turnWeightTargetRef.current = 0
                walkTimerRef.current += clampDelta
                const pos = groupRef.current?.position
                if (!pos) break
                const dx = wanderTargetRef.current.x - pos.x
                const dz = wanderTargetRef.current.z - pos.z
                const dist = Math.sqrt(dx * dx + dz * dz)

                // Stop after 2-3 seconds OR arrival
                if (dist < 0.15 || walkTimerRef.current >= MAX_WALK_TIME) {
                    wanderStateRef.current = 'SLOWING'
                    walkWeightTargetRef.current = 0
                } else {
                    // Move forward in facing direction
                    const moveX = Math.sin(facingAngleRef.current) * WALK_SPEED * clampDelta
                    const moveZ = Math.cos(facingAngleRef.current) * WALK_SPEED * clampDelta
                    pos.x += moveX
                    pos.z += moveZ
                }
                break
            }
            case 'SLOWING': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 0
                if (walkWeightRef.current < 0.08) {
                    wanderStateRef.current = 'IDLE_STANDING'
                    wanderTimerRef.current = 4 + Math.random() * 6
                }
                break
            }
            case 'STOPPING': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 0
                if (walkWeightRef.current < 0.05) {
                    wanderStateRef.current = 'CONVERSATION'
                }
                break
            }
            case 'CONVERSATION': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 0
                // Face the camera
                const pos = groupRef.current?.position
                if (pos) {
                    const camPos = state.camera.position
                    const dx = camPos.x - pos.x
                    const dz = camPos.z - pos.z
                    const targetAngle = Math.atan2(dx, dz)
                    let angleDiff = targetAngle - facingAngleRef.current
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
                    facingAngleRef.current += Math.sign(angleDiff) * Math.min(ROTATION_SPEED * clampDelta, Math.abs(angleDiff))
                }
                break
            }
            case 'RESUME_PAUSE': {
                walkWeightTargetRef.current = 0
                turnWeightTargetRef.current = 0
                wanderTimerRef.current -= clampDelta
                if (wanderTimerRef.current <= 0) {
                    wanderStateRef.current = 'IDLE_STANDING'
                    wanderTimerRef.current = 2 + Math.random() * 3
                }
                break
            }
        }

        // Blend animation weights: idle ↔ walk ↔ turn left/right
        walkWeightRef.current += (walkWeightTargetRef.current - walkWeightRef.current) * Math.min(1, BLEND_SPEED * clampDelta)
        turnWeightRef.current += (turnWeightTargetRef.current - turnWeightRef.current) * Math.min(1, BLEND_SPEED * clampDelta)
        const w = walkWeightRef.current
        const t = turnWeightRef.current

        // Apply rotation to group; keep Y at default so only x/z change when turning/walking
        if (groupRef.current) {
            groupRef.current.rotation.y = facingAngleRef.current
            groupRef.current.position.y = -0.75
        }
        const turnDir = turnDirectionRef.current
        if (idleActionRef.current) idleActionRef.current.setEffectiveWeight(1 - w - t)
        if (walkActionRef.current) walkActionRef.current.setEffectiveWeight(w)
        if (turnLeftActionRef.current) turnLeftActionRef.current.setEffectiveWeight(turnDir === 'left' ? t : 0)
        if (turnRightActionRef.current) turnRightActionRef.current.setEffectiveWeight(turnDir === 'right' ? t : 0)

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

        // ===== EMOTION BLENDING =====
        // Smoothly transition between emotions
        const emotion = currentEmotion || 'neutral'
        if (emotion !== currentEmotionRef.current) {
            currentEmotionRef.current = emotion
        }

        // Define emotion expression targets
        const emotionExpressions = {
            neutral: {
                browInnerUp: 0, browOuterUpLeft: 0, browOuterUpRight: 0,
                browDownLeft: 0, browDownRight: 0,
                mouthSmileLeft: 0.03, mouthSmileRight: 0.03,
                cheekSquintLeft: 0, cheekSquintRight: 0,
                noseSneerLeft: 0, noseSneerRight: 0,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0, eyeWideRight: 0,
            },
            happy: {
                browInnerUp: 0.1, browOuterUpLeft: 0.15, browOuterUpRight: 0.15,
                browDownLeft: 0, browDownRight: 0,
                mouthSmileLeft: 0.35, mouthSmileRight: 0.35,
                cheekSquintLeft: 0.25, cheekSquintRight: 0.25,
                noseSneerLeft: 0.05, noseSneerRight: 0.05,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0, eyeWideRight: 0,
            },
            sad: {
                browInnerUp: 0.35, browOuterUpLeft: 0, browOuterUpRight: 0,
                browDownLeft: 0.15, browDownRight: 0.15,
                mouthSmileLeft: 0, mouthSmileRight: 0,
                cheekSquintLeft: 0, cheekSquintRight: 0,
                noseSneerLeft: 0, noseSneerRight: 0,
                mouthFrownLeft: 0.25, mouthFrownRight: 0.25,
                eyeWideLeft: 0, eyeWideRight: 0,
            },
            excited: {
                browInnerUp: 0.2, browOuterUpLeft: 0.3, browOuterUpRight: 0.3,
                browDownLeft: 0, browDownRight: 0,
                mouthSmileLeft: 0.3, mouthSmileRight: 0.3,
                cheekSquintLeft: 0.15, cheekSquintRight: 0.15,
                noseSneerLeft: 0, noseSneerRight: 0,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0.2, eyeWideRight: 0.2,
            },
            surprised: {
                browInnerUp: 0.4, browOuterUpLeft: 0.35, browOuterUpRight: 0.35,
                browDownLeft: 0, browDownRight: 0,
                mouthSmileLeft: 0, mouthSmileRight: 0,
                cheekSquintLeft: 0, cheekSquintRight: 0,
                noseSneerLeft: 0, noseSneerRight: 0,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0.35, eyeWideRight: 0.35,
            },
            thoughtful: {
                browInnerUp: 0.15, browOuterUpLeft: 0.05, browOuterUpRight: 0.12,
                browDownLeft: 0.1, browDownRight: 0,
                mouthSmileLeft: 0.05, mouthSmileRight: 0.08,
                cheekSquintLeft: 0.05, cheekSquintRight: 0.03,
                noseSneerLeft: 0, noseSneerRight: 0,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0, eyeWideRight: 0,
            },
            amused: {
                browInnerUp: 0.1, browOuterUpLeft: 0.2, browOuterUpRight: 0.2,
                browDownLeft: 0, browDownRight: 0,
                mouthSmileLeft: 0.4, mouthSmileRight: 0.4,
                cheekSquintLeft: 0.3, cheekSquintRight: 0.3,
                noseSneerLeft: 0.08, noseSneerRight: 0.08,
                mouthFrownLeft: 0, mouthFrownRight: 0,
                eyeWideLeft: 0, eyeWideRight: 0,
            },
        }

        const targetExpression = emotionExpressions[emotion] || emotionExpressions.neutral
        const emotionSpeed = 0.04 // Slow blend for natural transitions

        // ===== BONE-BASED MICRO-MOTIONS =====

        // Breathing — slightly deeper when speaking
        if (spineBoneRef.current && initialBoneRotations.current.spineY !== undefined) {
            const breathRate = isAudioPlaying ? 0.5 : 0.4
            const breathDepth = isAudioPlaying ? 0.0008 : 0.0006
            const breathCycle = Math.sin(elapsedTime * breathRate * Math.PI * 2)
            spineBoneRef.current.position.y = initialBoneRotations.current.spineY + breathCycle * breathDepth
        }

        // Head movement — changes based on conversation state
        if (headBoneRef.current && initialBoneRotations.current.head) {
            const base = initialBoneRotations.current.head
            let headX = 0, headY = 0, headZ = 0

            if (isAudioPlaying) {
                // Speaking: subtle nods on emphasis + gentle sway
                const ampDelta = amplitude - prevAmplitudeRef.current
                if (ampDelta > 0.05) speechEmphasisRef.current = Math.min(speechEmphasisRef.current + ampDelta * 2, 0.3)
                speechEmphasisRef.current *= 0.92 // decay

                headX = Math.sin(elapsedTime * 0.3) * 0.005 + speechEmphasisRef.current * 0.015
                headY = Math.sin(elapsedTime * 0.25 + 1.0) * 0.008 + Math.sin(elapsedTime * 0.7) * 0.004
                headZ = Math.sin(elapsedTime * 0.2 + 2.0) * 0.003
            } else if (convState === 'thinking') {
                // Thinking: slight tilt and look-away
                headX = Math.sin(elapsedTime * 0.15) * 0.008
                headY = 0.03 + Math.sin(elapsedTime * 0.1) * 0.01 // tilted slightly
                headZ = Math.sin(elapsedTime * 0.12 + 1.0) * 0.005
            } else if (convState === 'listening') {
                // Listening: attentive slight forward lean + small tilts
                headX = -0.01 + Math.sin(elapsedTime * 0.2) * 0.004
                headY = Math.sin(elapsedTime * 0.15 + 0.5) * 0.006
                headZ = Math.sin(elapsedTime * 0.18 + 2.0) * 0.003
            } else {
                // Idle: gentle natural sway
                headX = Math.sin(elapsedTime * 0.25) * 0.006 + Math.sin(elapsedTime * 0.6) * 0.003
                headY = Math.sin(elapsedTime * 0.2 + 1.0) * 0.005 + Math.sin(elapsedTime * 0.5 + 0.5) * 0.002
                headZ = Math.sin(elapsedTime * 0.15 + 2.0) * 0.002
            }

            headBoneRef.current.rotation.x = base.x + headX
            headBoneRef.current.rotation.y = base.y + headY
            headBoneRef.current.rotation.z = base.z + headZ
        }
        prevAmplitudeRef.current = amplitude

        // Shoulder micro-shift
        if (neckBoneRef.current && initialBoneRotations.current.neck) {
            const shoulderShift = Math.sin(elapsedTime * 0.35 + 1.5) * 0.002
            neckBoneRef.current.rotation.z = initialBoneRotations.current.neck.z + shoulderShift
        }

        // ===== BLINKING (context-aware frequency) =====
        // Blink more during thinking, less while focused listening
        const blinkInterval = convState === 'thinking' ? (1.5 + Math.random() * 2)
                            : convState === 'listening' ? (3 + Math.random() * 5)
                            : (2 + Math.random() * 4)

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
                nextBlinkTimeRef.current = elapsedTime + (isDoubleBlink ? 0.25 : blinkInterval)
            }
        } else {
            applyMorph('eyeBlinkLeft', 0, 0.3)
            applyMorph('eyeBlinkRight', 0, 0.3)
        }

        // ===== EYE SACCADES (realistic micro eye movements) =====
        if (elapsedTime >= nextSaccadeTimeRef.current) {
            // Small random eye movement target
            const range = convState === 'thinking' ? 0.15 : 0.06
            saccadeTargetRef.current = {
                x: (Math.random() - 0.5) * range,
                y: (Math.random() - 0.5) * range * 0.6
            }
            // Next saccade in 0.3-2 seconds
            nextSaccadeTimeRef.current = elapsedTime + 0.3 + Math.random() * 1.7
        }

        // Smoothly move toward saccade target
        const saccadeSpeed = 0.08
        saccadeCurrentRef.current.x += (saccadeTargetRef.current.x - saccadeCurrentRef.current.x) * saccadeSpeed
        saccadeCurrentRef.current.y += (saccadeTargetRef.current.y - saccadeCurrentRef.current.y) * saccadeSpeed

        const sx = saccadeCurrentRef.current.x
        const sy = saccadeCurrentRef.current.y

        // Apply eye look morphs based on saccade direction
        applyMorph('eyeLookOutLeft', Math.max(0, -sx) * 0.5, 0.15)
        applyMorph('eyeLookInLeft', Math.max(0, sx) * 0.5, 0.15)
        applyMorph('eyeLookOutRight', Math.max(0, sx) * 0.5, 0.15)
        applyMorph('eyeLookInRight', Math.max(0, -sx) * 0.5, 0.15)
        applyMorph('eyeLookUpLeft', Math.max(0, sy) * 0.4, 0.15)
        applyMorph('eyeLookUpRight', Math.max(0, sy) * 0.4, 0.15)
        applyMorph('eyeLookDownLeft', Math.max(0, -sy) * 0.4, 0.15)
        applyMorph('eyeLookDownRight', Math.max(0, -sy) * 0.4, 0.15)

        // ===== RHUBARB VISEME DEFINITIONS =====
        // Each Rhubarb shape (A-H, X) maps to a full set of ARKit-compatible morph targets
        // These are the "pose" targets — the engine blends between them
        const VISEME_SHAPES = {
            X: { // silence / rest
                jawOpen: 0.01, mouthOpen: 0.01,
                viseme_PP: 0, viseme_FF: 0, viseme_TH: 0, viseme_O: 0, viseme_E: 0,
                viseme_aa: 0, viseme_I: 0, viseme_U: 0, viseme_kk: 0, viseme_CH: 0,
                viseme_SS: 0, viseme_nn: 0, viseme_RR: 0, viseme_DD: 0,
                mouthPucker: 0, mouthFunnel: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
                mouthShrugUpper: 0, mouthShrugLower: 0, mouthClose: 0,
                mouthLowerDownLeft: 0, mouthLowerDownRight: 0,
                mouthUpperUpLeft: 0, mouthUpperUpRight: 0,
            },
            A: { // "ah" — open jaw, relaxed lips (like "park", "car")
                jawOpen: 0.38, mouthOpen: 0.42, viseme_aa: 0.5,
                mouthLowerDownLeft: 0.18, mouthLowerDownRight: 0.18,
                mouthShrugLower: 0.1, mouthUpperUpLeft: 0.04, mouthUpperUpRight: 0.04,
            },
            B: { // closed lips — "p", "b", "m"
                jawOpen: 0.02, mouthOpen: 0.0, viseme_PP: 0.55,
                mouthClose: 0.35, mouthShrugUpper: 0.12, mouthShrugLower: 0.12,
                mouthPucker: 0.08,
            },
            C: { // "eh" / "ae" — half open, stretched (like "bed", "set")
                jawOpen: 0.2, mouthOpen: 0.24, viseme_E: 0.4,
                mouthStretchLeft: 0.18, mouthStretchRight: 0.18,
                mouthLowerDownLeft: 0.08, mouthLowerDownRight: 0.08,
            },
            D: { // "ah" wide — like "dog", "talk"
                jawOpen: 0.32, mouthOpen: 0.38, viseme_aa: 0.45, viseme_DD: 0.28,
                mouthLowerDownLeft: 0.14, mouthLowerDownRight: 0.14,
                mouthUpperUpLeft: 0.06, mouthUpperUpRight: 0.06,
                mouthShrugLower: 0.05,
            },
            E: { // "ee" — narrow mouth, stretched wide (like "keep", "see")
                jawOpen: 0.1, mouthOpen: 0.12, viseme_E: 0.45, viseme_I: 0.3,
                mouthStretchLeft: 0.25, mouthStretchRight: 0.25,
                mouthShrugUpper: 0.06,
            },
            F: { // "f" / "v" — upper teeth on lower lip
                jawOpen: 0.08, mouthOpen: 0.05, viseme_FF: 0.5,
                mouthUpperUpLeft: 0.12, mouthUpperUpRight: 0.12,
                mouthShrugLower: 0.08,
            },
            G: { // "oo" — rounded, puckered (like "food", "blue")
                jawOpen: 0.2, mouthOpen: 0.22, viseme_O: 0.45, viseme_U: 0.25,
                mouthPucker: 0.3, mouthFunnel: 0.28,
            },
            H: { // "th" / "l" — tongue visible, jaw slightly open
                jawOpen: 0.12, mouthOpen: 0.16, viseme_TH: 0.35, viseme_nn: 0.2,
                mouthShrugUpper: 0.08,
                mouthLowerDownLeft: 0.06, mouthLowerDownRight: 0.06,
            },
        }

        // Fill missing keys with 0 so blending works
        const ALL_MORPH_KEYS = Object.keys(VISEME_SHAPES.X)
        for (const shape of Object.values(VISEME_SHAPES)) {
            for (const key of ALL_MORPH_KEYS) {
                if (shape[key] === undefined) shape[key] = 0
            }
        }

        // ===== FRAME-RATE INDEPENDENT SMOOTHING =====
        // exponential decay: current + (target - current) * (1 - e^(-rate * dt))
        const smoothDamp = (current, target, rate, dt) => {
            const factor = 1 - Math.exp(-rate * dt)
            return current + (target - current) * factor
        }

        // ===== LIP SYNC ENGINE =====
        if (isAudioPlaying) {
            const currentTime = audioElement.currentTime || 0
            const ampMod = 0.85 + amplitude * 0.25

            // --- Find current + next cue using optimized search ---
            let currentCue = null
            let nextCue = null
            let cueProgress = 0 // 0..1 how far through the current cue

            if (hasLipSyncData) {
                const mouthCues = lipSyncData.mouthCues
                // Start search from last known index for efficiency
                let startIdx = Math.max(0, lastCueIndexRef.current - 1)
                if (startIdx >= mouthCues.length) startIdx = 0

                // Search forward from last position
                for (let i = startIdx; i < mouthCues.length; i++) {
                    if (currentTime >= mouthCues[i].start && currentTime <= mouthCues[i].end) {
                        currentCue = mouthCues[i]
                        nextCue = i + 1 < mouthCues.length ? mouthCues[i + 1] : null
                        lastCueIndexRef.current = i

                        // Calculate progress through this cue (0 = start, 1 = end)
                        const cueDuration = currentCue.end - currentCue.start
                        cueProgress = cueDuration > 0 ? (currentTime - currentCue.start) / cueDuration : 0
                        break
                    }
                }

                // If not found forward, search from beginning
                if (!currentCue && startIdx > 0) {
                    for (let i = 0; i < startIdx; i++) {
                        if (currentTime >= mouthCues[i].start && currentTime <= mouthCues[i].end) {
                            currentCue = mouthCues[i]
                            nextCue = i + 1 < mouthCues.length ? mouthCues[i + 1] : null
                            lastCueIndexRef.current = i
                            const cueDuration = currentCue.end - currentCue.start
                            cueProgress = cueDuration > 0 ? (currentTime - currentCue.start) / cueDuration : 0
                            break
                        }
                    }
                }
            }

            // --- Build blended target shape ---
            let targetShape = { ...VISEME_SHAPES.X }

            if (currentCue) {
                const currentShape = VISEME_SHAPES[currentCue.value] || VISEME_SHAPES.X
                const prevShape = VISEME_SHAPES[prevCueRef.current] || VISEME_SHAPES.X
                const nextShape = nextCue ? (VISEME_SHAPES[nextCue.value] || VISEME_SHAPES.X) : VISEME_SHAPES.X

                // === COARTICULATION ===
                // The mouth shape is influenced by:
                // 1. The current phoneme (main weight)
                // 2. The previous phoneme (carry-over, fading out)
                // 3. The next phoneme (anticipation, fading in near the end)

                // Blend zone: last 30% of cue anticipates the next shape
                const ANTICIPATION_ZONE = 0.7
                // Blend zone: first 15% of cue carries over from previous
                const CARRYOVER_ZONE = 0.15

                for (const key of ALL_MORPH_KEYS) {
                    let value = currentShape[key]

                    // Carry-over from previous phoneme (first 15% of cue)
                    if (cueProgress < CARRYOVER_ZONE) {
                        const carryWeight = 1 - (cueProgress / CARRYOVER_ZONE) // 1 → 0
                        value = value * (1 - carryWeight * 0.3) + prevShape[key] * carryWeight * 0.3
                    }

                    // Anticipation of next phoneme (last 30% of cue)
                    if (cueProgress > ANTICIPATION_ZONE && nextCue) {
                        const anticipateWeight = (cueProgress - ANTICIPATION_ZONE) / (1 - ANTICIPATION_ZONE) // 0 → 1
                        // Smooth ease-in curve
                        const eased = anticipateWeight * anticipateWeight
                        value = value * (1 - eased * 0.4) + nextShape[key] * eased * 0.4
                    }

                    // Apply amplitude modulation to jaw/mouth opening
                    if (key === 'jawOpen' || key === 'mouthOpen') {
                        value *= ampMod
                    }

                    targetShape[key] = value
                }

                prevCueRef.current = currentCue.value
            } else {
                // No cue found — use gentle amplitude-based fallback
                const wave = Math.sin(currentTime * 8) * 0.5 + 0.5
                targetShape.jawOpen = (0.08 + wave * 0.08) * ampMod
                targetShape.mouthOpen = (0.06 + wave * 0.06) * ampMod
            }

            // --- Apply morph targets with frame-rate independent smoothing ---
            // Different rates for opening (fast, 18/s) vs closing (slower, 10/s)
            const OPEN_RATE = 18
            const CLOSE_RATE = 10
            const clampedDelta = Math.min(delta, 0.05) // cap at 50ms to avoid jumps

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

                    // Map morph key names to indices
                    const morphMap = {
                        jawOpen: getIdx('jawOpen', 49),
                        mouthOpen: getIdx('mouthOpen', 0),
                        viseme_PP: getIdx('viseme_PP', 2),
                        viseme_FF: getIdx('viseme_FF', 3),
                        viseme_TH: getIdx('viseme_TH', 4),
                        viseme_O: getIdx('viseme_O', 65),
                        viseme_E: getIdx('viseme_E', 63),
                        viseme_aa: getIdx('viseme_aa', 62),
                        viseme_I: getIdx('viseme_I', 64),
                        viseme_U: getIdx('viseme_U', 66),
                        viseme_kk: getIdx('viseme_kk', 57),
                        viseme_CH: getIdx('viseme_CH', 58),
                        viseme_SS: getIdx('viseme_SS', 59),
                        viseme_nn: getIdx('viseme_nn', 60),
                        viseme_RR: getIdx('viseme_RR', 61),
                        viseme_DD: getIdx('viseme_DD', 56),
                        mouthPucker: getIdx('mouthPucker', undefined),
                        mouthFunnel: getIdx('mouthFunnel', undefined),
                        mouthStretchLeft: getIdx('mouthStretchLeft', undefined),
                        mouthStretchRight: getIdx('mouthStretchRight', undefined),
                        mouthShrugUpper: getIdx('mouthShrugUpper', undefined),
                        mouthShrugLower: getIdx('mouthShrugLower', undefined),
                        mouthClose: getIdx('mouthClose', undefined),
                        mouthLowerDownLeft: getIdx('mouthLowerDownLeft', undefined),
                        mouthLowerDownRight: getIdx('mouthLowerDownRight', undefined),
                        mouthUpperUpLeft: getIdx('mouthUpperUpLeft', undefined),
                        mouthUpperUpRight: getIdx('mouthUpperUpRight', undefined),
                    }

                    for (const key of ALL_MORPH_KEYS) {
                        const idx = morphMap[key]
                        if (idx === undefined || idx >= infl.length) continue

                        const target = targetShape[key] || 0
                        const current = infl[idx] || 0
                        const rate = target > current ? OPEN_RATE : CLOSE_RATE
                        infl[idx] = Math.max(0, Math.min(1, smoothDamp(current, target, rate, clampedDelta)))
                    }
                }
            })

            // --- Jaw bone physical rotation (adds to morph target jaw) ---
            if (jawBoneRef.current && initialJawRotation.current) {
                const jawTarget = (targetShape.jawOpen || 0) * 0.12 // radians, ~7 degrees max
                const currentJawRot = jawBoneRef.current.rotation.x - initialJawRotation.current.x
                const newJawRot = smoothDamp(currentJawRot, jawTarget, 14, clampedDelta)
                jawBoneRef.current.rotation.x = initialJawRotation.current.x + newJawRot
            }

            // --- Emotion expressions WHILE speaking (layered on top) ---
            for (const [morphName, targetVal] of Object.entries(targetExpression)) {
                const speechBoost = morphName.includes('Smile') ? amplitude * 0.08 : 0
                applyMorph(morphName, targetVal + speechBoost, emotionSpeed * 1.5)
            }

        } else {
            // ===== NOT SPEAKING =====
            prevCueRef.current = null
            lastCueIndexRef.current = 0

            // Decay all mouth/viseme morphs with frame-rate independent smoothing
            const clampedDelta = Math.min(delta, 0.05)
            const DECAY_RATE = 8 // per second

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
                            infl[i] = smoothDamp(infl[i], 0, DECAY_RATE, clampedDelta)
                        }
                    })
                }
            })

            // Reset jaw bone
            if (jawBoneRef.current && initialJawRotation.current) {
                const breathJaw = (Math.sin(elapsedTime * 1.5) * 0.5 + 0.5) * 0.005
                const currentOffset = jawBoneRef.current.rotation.x - initialJawRotation.current.x
                const newOffset = smoothDamp(currentOffset, breathJaw, 6, clampedDelta)
                jawBoneRef.current.rotation.x = initialJawRotation.current.x + newOffset
            }

            // Subtle breathing jaw via morph
            const breathValue = (Math.sin(elapsedTime * 1.5) * 0.5 + 0.5) * 0.015
            applyMorph('jawOpen', breathValue, 0.1)

            // Slight idle squint
            const squintBase = convState === 'thinking' ? 0.08 : 0.03
            const squintWave = (Math.sin(elapsedTime * 0.7) * 0.5 + 0.5) * squintBase
            applyMorph('eyeSquintLeft', squintWave, 0.05)
            applyMorph('eyeSquintRight', squintWave, 0.05)

            // Apply emotion expressions
            for (const [morphName, targetVal] of Object.entries(targetExpression)) {
                applyMorph(morphName, targetVal, emotionSpeed)
            }

            // Conversation-state-specific expressions
            if (convState === 'thinking') {
                applyMorph('browInnerUp', 0.2 + Math.sin(elapsedTime * 0.3) * 0.05, 0.05)
                applyMorph('mouthPressLeft', 0.12, 0.05)
                applyMorph('mouthPressRight', 0.08, 0.05)
            } else if (convState === 'listening') {
                applyMorph('browOuterUpLeft', 0.08, 0.04)
                applyMorph('browOuterUpRight', 0.08, 0.04)
                applyMorph('mouthSmileLeft', 0.06, 0.04)
                applyMorph('mouthSmileRight', 0.06, 0.04)
            }
        }
    })

    return (
        <group ref={groupRef} position={[0, -0.75, 1]}>
            <primitive
                object={scene}
                scale={1.5}
                position={[0, 0, 0]}
            />
        </group>
    )
}

useGLTF.preload('/models/avtarr.glb')
useFBX.preload('/models/animations/Walking.fbx')
