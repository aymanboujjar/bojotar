import { useGLTF } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useLipSync } from '../hooks/useLipSync'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Avatar() {
    const { scene } = useGLTF('/models/avatar.glb')
    const headRef = useRef()
    const groupRef = useRef()
    const mixerRef = useRef(null)
    const currentActionRef = useRef(null)
    const nextActionRef = useRef(null)
    const avatarSkeletonRef = useRef(null)
    const { animationType, audioElement, lipSyncData } = useLipSyncContext()
    const animationsRef = useRef({
        salute: null,
        offensiveIdle: null,
        yelling: null
    })
    const saluteEndCheckRef = useRef(null)

    useEffect(() => {
        // Find the head mesh with morph targets
        scene.traverse((obj) => {
            if (obj.isSkinnedMesh && obj.morphTargetDictionary) {
                if (obj.name === 'Wolf3D_Head') {
                    headRef.current = obj
                    console.log('✅ Found head mesh:', obj.name)
                    console.log('📋 Available morph targets:', Object.keys(obj.morphTargetDictionary))
                } else if (!headRef.current && obj.morphTargetDictionary) {
                    headRef.current = obj
                    console.log('✅ Found mesh with morph targets:', obj.name)
                    console.log('📋 Available morph targets:', Object.keys(obj.morphTargetDictionary))
                }
            }
            // Find the skeleton for animation retargeting
            if (obj.isSkinnedMesh && obj.skeleton && !avatarSkeletonRef.current) {
                avatarSkeletonRef.current = obj.skeleton
                console.log('✅ Found avatar skeleton:', obj.name)
                console.log('📋 Skeleton bones count:', obj.skeleton.bones.length)
            }
        })
        
        if (!headRef.current) {
            console.warn('⚠️ No head mesh found!')
        }

        // Create animation mixer
        mixerRef.current = new THREE.AnimationMixer(scene)
        console.log('✅ Animation mixer created')

        // Improved retargeting function with better bone matching
        const retargetAnimation = (fbxClip, fbxScene, targetSkeleton) => {
            if (!fbxClip || !targetSkeleton) return null
            
            try {
                // Get bone names from both skeletons
                const targetBones = {}
                targetSkeleton.bones.forEach((bone) => {
                    targetBones[bone.name.toLowerCase()] = bone.name
                })
                
                // Get FBX bone names
                const fbxBones = {}
                if (fbxScene) {
                    fbxScene.traverse((obj) => {
                        if (obj.isBone || obj.type === 'Bone') {
                            fbxBones[obj.name.toLowerCase()] = obj.name
                        }
                    })
                }
                
                const tracks = []
                const boneMap = new Map()
                
                // Process each track in the FBX clip
                fbxClip.tracks.forEach((track) => {
                    // Extract bone name from track name
                    const trackNameParts = track.name.split('.')
                    let fbxBoneName = trackNameParts[0]
                    
                    // Handle FBX naming (remove "Scene/" prefix if present)
                    if (fbxBoneName.includes('/')) {
                        fbxBoneName = fbxBoneName.split('/').pop()
                    }
                    
                    const property = trackNameParts[1]
                    if (!property) return
                    
                    // Find matching bone in target skeleton
                    let targetBoneName = null
                    const lowerFbxName = fbxBoneName.toLowerCase()
                    
                    // Strategy 1: Exact match (case-insensitive)
                    if (targetBones[lowerFbxName]) {
                        targetBoneName = targetBones[lowerFbxName]
                    } else {
                        // Strategy 2: Partial match - check if target bone name contains FBX bone name or vice versa
                        // Use a scoring system to find the best match
                        let bestMatch = null
                        let bestScore = 0
                        
                        for (const [lowerTargetName, targetName] of Object.entries(targetBones)) {
                            let score = 0
                            
                            // Exact substring match gets highest score
                            if (lowerTargetName === lowerFbxName) {
                                score = 100
                            } else if (lowerTargetName.includes(lowerFbxName) || lowerFbxName.includes(lowerTargetName)) {
                                // Calculate similarity score based on common characters
                                const commonChars = [...lowerFbxName].filter(char => lowerTargetName.includes(char)).length
                                score = (commonChars / Math.max(lowerFbxName.length, lowerTargetName.length)) * 50
                                
                                // Bonus for similar length
                                const lengthDiff = Math.abs(lowerTargetName.length - lowerFbxName.length)
                                score += Math.max(0, 20 - lengthDiff)
                            }
                            
                            if (score > bestScore && score > 30) { // Minimum threshold
                                bestScore = score
                                bestMatch = targetName
                            }
                        }
                        
                        if (bestMatch) {
                            targetBoneName = bestMatch
                        }
                        
                        // Strategy 3: Common bone name mappings
                        if (!targetBoneName) {
                            const boneMappings = {
                                'mixamorig:hips': ['hip', 'pelvis', 'root', 'hips'],
                                'mixamorig:spine': ['spine', 'spine1', 'spine2'],
                                'mixamorig:spine1': ['spine1', 'spine'],
                                'mixamorig:spine2': ['spine2', 'spine'],
                                'mixamorig:neck': ['neck', 'neck1'],
                                'mixamorig:head': ['head'],
                                'mixamorig:leftshoulder': ['leftshoulder', 'lshoulder', 'shoulder_l'],
                                'mixamorig:rightshoulder': ['rightshoulder', 'rshoulder', 'shoulder_r'],
                                'mixamorig:leftarm': ['leftarm', 'larm', 'arm_l', 'upperarm_l'],
                                'mixamorig:rightarm': ['rightarm', 'rarm', 'arm_r', 'upperarm_r'],
                                'mixamorig:leftforearm': ['leftforearm', 'lforearm', 'forearm_l', 'lowerarm_l'],
                                'mixamorig:rightforearm': ['rightforearm', 'rforearm', 'forearm_r', 'lowerarm_r'],
                                'mixamorig:lefthand': ['lefthand', 'lhand', 'hand_l'],
                                'mixamorig:righthand': ['righthand', 'rhand', 'hand_r'],
                                'mixamorig:leftupleg': ['leftupleg', 'lthigh', 'thigh_l', 'upperleg_l'],
                                'mixamorig:rightupleg': ['rightupleg', 'rthigh', 'thigh_r', 'upperleg_r'],
                                'mixamorig:leftleg': ['leftleg', 'lcalf', 'calf_l', 'lowerleg_l'],
                                'mixamorig:rightleg': ['rightleg', 'rcalf', 'calf_r', 'lowerleg_r'],
                                'mixamorig:leftfoot': ['leftfoot', 'lfoot', 'foot_l'],
                                'mixamorig:rightfoot': ['rightfoot', 'rfoot', 'foot_r']
                            }
                            
                            // Check if FBX bone matches any mapping
                            for (const [targetKey, variations] of Object.entries(boneMappings)) {
                                if (variations.some(v => lowerFbxName.includes(v) || v.includes(lowerFbxName))) {
                                    // Find target bone that matches the key
                                    for (const [lowerTargetName, targetName] of Object.entries(targetBones)) {
                                        if (lowerTargetName.includes(targetKey.split(':')[1]) || 
                                            targetKey.split(':')[1].includes(lowerTargetName.replace('mixamorig:', ''))) {
                                            targetBoneName = targetName
                                            break
                                        }
                                    }
                                    if (targetBoneName) break
                                }
                            }
                        }
                    }
                    
                    if (targetBoneName && property) {
                        // Create new track for target skeleton
                        const newTrackName = `${targetBoneName}.${property}`
                        const newTrack = track.clone()
                        newTrack.name = newTrackName
                        tracks.push(newTrack)
                        
                        if (!boneMap.has(fbxBoneName)) {
                            boneMap.set(fbxBoneName, targetBoneName)
                        }
                    }
                })
                
                if (tracks.length > 0) {
                    console.log(`✅ Retargeted ${tracks.length}/${fbxClip.tracks.length} tracks from ${fbxClip.name}`)
                    if (boneMap.size > 0) {
                        console.log('📋 Sample bone mappings:', Array.from(boneMap.entries()).slice(0, 8))
                    }
                    return new THREE.AnimationClip(fbxClip.name, fbxClip.duration, tracks)
                } else {
                    console.warn(`⚠️ No tracks retargeted for ${fbxClip.name}, trying original`)
                }
            } catch (error) {
                console.error('❌ Error retargeting animation:', error)
            }
            
            // Fallback: try original clip
            return fbxClip
        }

        // Load FBX animations
        const loader = new FBXLoader()
        
        // Load Salute animation
        loader.load('/models/Salute.fbx', (fbx) => {
            const originalClip = fbx.animations[0]
            if (originalClip) {
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(originalClip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.salute = retargetedClip || originalClip
                    console.log('✅ Salute animation ready:', animationsRef.current.salute.name, animationsRef.current.salute.duration, 'seconds')
                } else {
                    animationsRef.current.salute = originalClip
                    console.log('✅ Salute animation loaded (no skeleton for retargeting):', originalClip.name, originalClip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Salute.fbx:', error)
        })

        // Load Offensive Idle animation
        loader.load('/models/Offensive Idle.fbx', (fbx) => {
            const originalClip = fbx.animations[0]
            if (originalClip) {
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(originalClip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.offensiveIdle = retargetedClip || originalClip
                    console.log('✅ Offensive Idle animation ready:', animationsRef.current.offensiveIdle.name, animationsRef.current.offensiveIdle.duration, 'seconds')
                } else {
                    animationsRef.current.offensiveIdle = originalClip
                    console.log('✅ Offensive Idle animation loaded (no skeleton for retargeting):', originalClip.name, originalClip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Offensive Idle.fbx:', error)
        })

        // Load Yelling While Standing animation
        loader.load('/models/Yelling While Standing.fbx', (fbx) => {
            const originalClip = fbx.animations[0]
            if (originalClip) {
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(originalClip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.yelling = retargetedClip || originalClip
                    console.log('✅ Yelling While Standing animation ready:', animationsRef.current.yelling.name, animationsRef.current.yelling.duration, 'seconds')
                } else {
                    animationsRef.current.yelling = originalClip
                    console.log('✅ Yelling While Standing animation loaded (no skeleton for retargeting):', originalClip.name, originalClip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Yelling While Standing.fbx:', error)
        })

    }, [scene])

    // Handle animation changes based on animationType and lipSyncData
    useEffect(() => {
        if (!mixerRef.current || !audioElement) return

        const mixer = mixerRef.current
        const animations = animationsRef.current

        // For default animation (thanks): Play Offensive Idle ONLY after lip sync data is loaded
        if (animationType === 'thanks') {
            // Wait for lip sync data to be loaded before starting animation
            if (lipSyncData && lipSyncData.mouthCues && lipSyncData.mouthCues.length > 0) {
                // Only start animation if it's not already playing
                if (!currentActionRef.current && animations.offensiveIdle) {
                    const idleAction = mixer.clipAction(animations.offensiveIdle)
                    idleAction.reset()
                    idleAction.setLoop(THREE.LoopRepeat, Infinity)
                    idleAction.setEffectiveTimeScale(1.0)
                    idleAction.setEffectiveWeight(1.0)
                    idleAction.time = 0
                    idleAction.play()
                    currentActionRef.current = idleAction
                    console.log('🎬 Playing Offensive Idle animation (lip sync data loaded)')
                } else if (currentActionRef.current) {
                    // Ensure animation continues playing while audio is playing
                    if (!currentActionRef.current.isRunning()) {
                        currentActionRef.current.play()
                        console.log('🎬 Resuming Offensive Idle animation')
                    } else if (audioElement && !audioElement.paused && !audioElement.ended) {
                        // Animation is running and audio is playing - keep it going
                        // No action needed, animation should continue
                    }
                }
            } else {
                console.log('⏳ Waiting for lip sync data before starting Offensive Idle animation...')
            }
        } else if (animationType === 'tzaghrita') {
            // Clean up previous animation check
            if (saluteEndCheckRef.current) {
                cancelAnimationFrame(saluteEndCheckRef.current)
                saluteEndCheckRef.current = null
            }

            // Stop and reset current animation with smooth fade (only if changing animation type)
            if (currentActionRef.current) {
                currentActionRef.current.fadeOut(0.25)
                setTimeout(() => {
                    if (currentActionRef.current) {
                        currentActionRef.current.stop()
                        currentActionRef.current.reset()
                        currentActionRef.current = null
                    }
                }, 250)
            }
            // Play Yelling While Standing
            if (animations.yelling) {
                const yellingAction = mixer.clipAction(animations.yelling)
                yellingAction.reset()
                yellingAction.setLoop(THREE.LoopRepeat, Infinity)
                yellingAction.setEffectiveTimeScale(1.0)
                yellingAction.setEffectiveWeight(1.0)
                yellingAction.time = 0
                yellingAction.play()
                currentActionRef.current = yellingAction
                console.log('🎬 Playing Yelling While Standing animation')
            }
        }

        // Stop animation when audio ends or pauses with smooth fade
        const handleAudioEnd = () => {
            if (saluteEndCheckRef.current) {
                cancelAnimationFrame(saluteEndCheckRef.current)
                saluteEndCheckRef.current = null
            }
            
            if (currentActionRef.current) {
                currentActionRef.current.fadeOut(0.6)
                setTimeout(() => {
                    if (currentActionRef.current) {
                        currentActionRef.current.stop()
                        currentActionRef.current.reset()
                        currentActionRef.current = null
                    }
                }, 600)
            }
            if (nextActionRef.current) {
                nextActionRef.current.fadeOut(0.6)
                setTimeout(() => {
                    if (nextActionRef.current) {
                        nextActionRef.current.stop()
                        nextActionRef.current.reset()
                        nextActionRef.current = null
                    }
                }, 600)
            }
        }

        audioElement.addEventListener('ended', handleAudioEnd)
        audioElement.addEventListener('pause', handleAudioEnd)

        return () => {
            audioElement.removeEventListener('ended', handleAudioEnd)
            audioElement.removeEventListener('pause', handleAudioEnd)
            if (saluteEndCheckRef.current) {
                cancelAnimationFrame(saluteEndCheckRef.current)
                saluteEndCheckRef.current = null
            }
        }
    }, [animationType, audioElement, lipSyncData])

    // Update animation mixer every frame with optimal delta handling
    useFrame((state, delta) => {
        if (mixerRef.current) {
            // Clamp delta to prevent large jumps that can cause animation glitches
            const clampedDelta = Math.min(delta, 0.1) // Max 100ms per frame
            mixerRef.current.update(clampedDelta)
        }
    })

    useLipSync(headRef)

    return (
        <>
            <primitive
                ref={groupRef}
                object={scene}
                scale={1.5}
                position={[0, -1.5, 0]}
            />
        </>
    )
}

useGLTF.preload('/models/avatar.glb')
