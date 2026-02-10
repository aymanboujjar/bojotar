import { useGLTF } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useLipSync } from '../hooks/useLipSync'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Avatar() {
    const { scene, animations } = useGLTF('/models/avtarr.glb')

    // Sitting animation loaded via FBX

    const headRef = useRef()
    const groupRef = useRef()
    const mixerRef = useRef(null)
    const currentActionRef = useRef(null)
    const defaultActionRef = useRef(null)
    const nextActionRef = useRef(null)
    const avatarSkeletonRef = useRef(null)
    const { animationType, audioElement, lipSyncData, setMorphTargetDictionary, getAmplitude } = useLipSyncContext()
    const animationsRef = useRef({
        salute: null,
        offensiveIdle: null,
        yelling: null
    })
    const saluteEndCheckRef = useRef(null)

    // Sitting animation refs
    const sittingActionRef = useRef(null)
    const sittingTalkingActionRef = useRef(null)

    // Facial expression refs
    const nextBlinkTimeRef = useRef(0)
    const blinkProgressRef = useRef(0)
    const isBlinkingRef = useRef(false)
    const prevCueRef = useRef(null)
    const prevCue2Ref = useRef(null) // 2-phoneme coarticulation history

    // Bone-based micro-motion refs
    const headBoneRef = useRef(null)
    const spineBoneRef = useRef(null)
    const neckBoneRef = useRef(null)

    // Eye saccade / micro-expression refs
    const nextSaccadeTimeRef = useRef(0)
    const saccadeTargetRef = useRef({ x: 0, y: 0 })
    const nextMicroExpressionRef = useRef(3)
    const microExpressionTypeRef = useRef(null)
    const microExpressionProgressRef = useRef(0)

    // Jaw bounce physics
    const jawBounceRef = useRef(0)
    const jawVelocityRef = useRef(0)
    const prevJawOpenRef = useRef(0)

    // Head nod on speech emphasis
    const headNodRef = useRef(0)
    const headNodVelocityRef = useRef(0)

    useEffect(() => {
        // Find the head mesh with morph targets - improved detection for new avatar
        console.log('🔍 GLTF Scene info:', {
            name: scene.name,
            type: scene.type,
            userData: scene.userData,
            hasAnimations: animations?.length > 0,
            animationCount: animations?.length
        })
        
        const meshesWithMorphs = []
        
        scene.traverse((obj) => {
            // Check for SkinnedMesh OR Mesh with morph targets
            const hasMorphTargets = obj.morphTargetDictionary && Object.keys(obj.morphTargetDictionary).length > 0
            
            if ((obj.isSkinnedMesh || obj.isMesh) && hasMorphTargets) {
                const morphCount = Object.keys(obj.morphTargetDictionary).length
                
                // Special logging for Teeth_Mesh or Head_Mesh to find where names are stored
                if (obj.name && (obj.name.toLowerCase().includes('teeth') || obj.name.toLowerCase().includes('head'))) {
                    console.log(`🔍 Detailed structure for ${obj.name}:`, {
                        name: obj.name,
                        type: obj.type,
                        morphTargetDictionary: obj.morphTargetDictionary,
                        morphTargetInfluences: obj.morphTargetInfluences?.slice(0, 5),
                        userData: obj.userData,
                        geometryUserData: obj.geometry?.userData,
                        geometryName: obj.geometry?.name,
                        geometryType: obj.geometry?.type,
                        parentName: obj.parent?.name,
                        parentUserData: obj.parent?.userData,
                        hasMorphAttributes: !!obj.geometry?.morphAttributes,
                        morphAttributeKeys: obj.geometry?.morphAttributes ? Object.keys(obj.geometry.morphAttributes) : []
                    })
                }
                
                meshesWithMorphs.push({
                    mesh: obj,
                    name: obj.name,
                    morphCount: morphCount,
                    morphTargets: Object.keys(obj.morphTargetDictionary),
                    type: obj.isSkinnedMesh ? 'SkinnedMesh' : 'Mesh'
                })
                
                // Find the skeleton for animation retargeting
                if (obj.isSkinnedMesh && obj.skeleton && !avatarSkeletonRef.current) {
                    avatarSkeletonRef.current = obj.skeleton
                    console.log('✅ Found avatar skeleton:', obj.name)
                    console.log('📋 Skeleton bones count:', obj.skeleton.bones.length)
                }
            }
        })
        
        // Log all meshes with morph targets
        console.log(`🔍 Found ${meshesWithMorphs.length} mesh(es) with morph targets:`)
        meshesWithMorphs.forEach(({ name, morphCount, morphTargets, type }) => {
            console.log(`  - ${name} (${type}): ${morphCount} morph targets`)
            console.log(`    Targets:`, morphTargets.slice(0, 20)) // Show first 20
        })
        
        // Select the mesh with best viseme support
        // Priority: 1) Teeth_Mesh (best visemes), 2) Head_Mesh, 3) Most morph targets
        let selectedMesh = null
        
        // Debug: show all mesh names before searching
        console.log('🔍 Available mesh names:', meshesWithMorphs.map(m => m.name))
        
        // CRITICAL: Select ALL mouth-related meshes for MAXIMUM lip sync visibility!
        // Apply lip sync to Head, Teeth, AND Tongue for ultra-visible movement
        const mouthMeshes = meshesWithMorphs.filter(m => {
            const lowerName = m.name.toLowerCase()
            return lowerName.includes('head') || 
                   lowerName.includes('teeth') || 
                   lowerName.includes('tongue') ||
                   lowerName.includes('face')
        })
        
        console.log(`🔍 Found ${mouthMeshes.length} mouth-related meshes:`, mouthMeshes.map(m => m.name))
        
        // Use Head_Mesh as primary (has most morph targets)
        const headMesh = mouthMeshes.find(m => m.name.toLowerCase().includes('head'))
        
        if (headMesh) {
            selectedMesh = headMesh.mesh
            // Store ALL mouth meshes in an array for multi-mesh lip sync
            selectedMesh.additionalLipSyncMeshes = mouthMeshes
                .filter(m => m.name !== headMesh.name)
                .map(m => m.mesh)
            console.log(`✅ Selected Head_Mesh as primary + ${selectedMesh.additionalLipSyncMeshes.length} additional meshes`)
            console.log(`   Primary: ${headMesh.name}`)
            console.log(`   Additional: ${selectedMesh.additionalLipSyncMeshes.map(m => m.name).join(', ')}`)
        } else if (mouthMeshes.length > 0) {
            // Fallback to first mouth mesh
            selectedMesh = mouthMeshes[0].mesh
            selectedMesh.additionalLipSyncMeshes = mouthMeshes.slice(1).map(m => m.mesh)
            console.log(`✅ Selected ${mouthMeshes[0].name} as primary + ${selectedMesh.additionalLipSyncMeshes.length} additional`)
        } else {
            // Last resort: use mesh with most morph targets
            const meshWithMostMorphs = meshesWithMorphs[0]
            if (meshWithMostMorphs) {
                selectedMesh = meshWithMostMorphs.mesh
                selectedMesh.additionalLipSyncMeshes = []
                console.log(`✅ Selected mesh with most morph targets: ${meshWithMostMorphs.name}`)
            }
        }
        
        if (selectedMesh) {
            headRef.current = selectedMesh
            console.log('✅ Lip sync mesh set:', selectedMesh.name)
            
            // Check if dictionary has numeric keys and needs rebuild
            const dictKeys = Object.keys(selectedMesh.morphTargetDictionary)
            console.log('📋 Initial morph target dictionary keys:', dictKeys.slice(0, 10))
            
            const hasNumericKeys = dictKeys.length > 0 && !isNaN(dictKeys[0])
            
            if (hasNumericKeys) {
                console.log('🔧 Attempting to rebuild morphTargetDictionary with proper names')
                
                // Try to find the morph target names from the GLTF structure
                let names = null
                
                // Search in various possible locations
                if (selectedMesh.geometry?.userData?.targetNames) {
                    names = selectedMesh.geometry.userData.targetNames
                    console.log('✅ Found names in geometry.userData.targetNames')
                } else if (selectedMesh.userData?.targetNames) {
                    names = selectedMesh.userData.targetNames
                    console.log('✅ Found names in mesh.userData.targetNames')
                } else if (selectedMesh.parent?.userData?.targetNames) {
                    names = selectedMesh.parent.userData.targetNames
                    console.log('✅ Found names in parent.userData.targetNames')
                } else if (selectedMesh.geometry?.morphAttributes?.position) {
                    // Try to extract from the GLTF extras or name properties
                    const morphAttrs = selectedMesh.geometry.morphAttributes.position
                    console.log('🔍 Found morphAttributes.position array, length:', morphAttrs.length)
                    
                    // Check if there's a _names array (sometimes GLTF loaders add this)
                    if (selectedMesh.geometry.morphAttributes._names) {
                        names = selectedMesh.geometry.morphAttributes._names
                        console.log('✅ Found names in morphAttributes._names')
                    }
                }
                
                if (names && Array.isArray(names) && names.length > 0) {
                    const newDict = {}
                    names.forEach((name, index) => {
                        newDict[name] = index
                    })
                    selectedMesh.morphTargetDictionary = newDict
                    console.log('✅ Dictionary rebuilt successfully!')
                    console.log('📋 New dictionary keys:', Object.keys(newDict).slice(0, 10))
                    // Store in context so useLipSync can use it (mesh dict gets corrupted by mixer)
                    setMorphTargetDictionary({ ...newDict })
                    console.log('💾 Saved correct dictionary to context')
                } else {
                    console.error('❌ Could not find morph target names to rebuild dictionary')
                    console.log('Available data:', {
                        geometryUserData: selectedMesh.geometry?.userData,
                        meshUserData: selectedMesh.userData,
                        parentUserData: selectedMesh.parent?.userData,
                        hasMorphAttributes: !!selectedMesh.geometry?.morphAttributes
                    })
                }
            } else {
                console.log('✅ Dictionary already has proper string names')
                // Store in context so useLipSync can use it (mesh dict gets corrupted by mixer)
                setMorphTargetDictionary({ ...selectedMesh.morphTargetDictionary })
                console.log('💾 Saved correct dictionary to context')
            }
            
            // Ensure morphTargetInfluences exists
            if (!selectedMesh.morphTargetInfluences) {
                const morphCount = Object.keys(selectedMesh.morphTargetDictionary).length
                selectedMesh.morphTargetInfluences = new Array(morphCount).fill(0)
                console.log('✅ Initialized morphTargetInfluences array:', morphCount)
            }
            
            // Log viseme targets
            const finalDictKeys = Object.keys(selectedMesh.morphTargetDictionary)
            const visemeTargets = finalDictKeys.filter(name =>
                typeof name === 'string' && (
                    name.toLowerCase().includes('viseme') ||
                    name.toLowerCase().includes('mouth') ||
                    name.toLowerCase().includes('jaw')
                )
            )
            
            if (visemeTargets.length > 0) {
                console.log('👄 Found viseme-like targets:', visemeTargets)
            } else {
                console.log('⚠️ No viseme-like targets found in dictionary keys:', dictKeys.slice(0, 10))
            }
        } else {
            console.warn('⚠️ No mesh found with morph targets!')
            console.warn('Available meshes:', meshesWithMorphs.map(m => m.name))
        }

        // Create animation mixer
        mixerRef.current = new THREE.AnimationMixer(scene)
        console.log('✅ Animation mixer created')

        // Play default animation from GLB file if available
        if (animations && animations.length > 0) {
            console.log(`✅ Found ${animations.length} animation(s) in GLB file:`, animations.map(a => a.name))
            // Use the first animation as default (this prevents T-pose)
            let defaultClip = animations[0]
            
            // Log all tracks to see what we're dealing with
            console.log(`🔍 Animation tracks (${defaultClip.tracks.length} total):`, 
                defaultClip.tracks.slice(0, 5).map(t => t.name))
            
            // CRITICAL: Remove morph target tracks from default animation to allow lip sync
            // Filter out any tracks that control morph target influences (mouth shapes)
            const filteredTracks = defaultClip.tracks.filter(track => {
                // Keep all tracks except morph target tracks for mouth/viseme shapes
                const isMorphTrack = track.name && (
                    track.name.includes('.morphTargetInfluences') ||
                    track.name.toLowerCase().includes('viseme') ||
                    track.name.toLowerCase().includes('mouth') ||
                    track.name.toLowerCase().includes('jaw')
                )
                if (isMorphTrack) {
                    console.log('🔇 Removing morph track from animation:', track.name)
                }
                return !isMorphTrack
            })
            
            // Create new clip without morph tracks if any were removed
            if (filteredTracks.length < defaultClip.tracks.length) {
                defaultClip = new THREE.AnimationClip(defaultClip.name, defaultClip.duration, filteredTracks)
                console.log(`✅ Filtered animation: removed ${animations[0].tracks.length - filteredTracks.length} morph tracks`)
            } else {
                console.log('ℹ️ No morph tracks found in animation to filter')
            }
            
            const defaultAction = mixerRef.current.clipAction(defaultClip)
            defaultAction.setLoop(THREE.LoopRepeat, Infinity)
            defaultAction.setEffectiveWeight(1.0)
            
            // CRITICAL: Disable morph target property mixers to prevent animation from overriding lip sync
            // This ensures animations only affect bones, not morph targets
            const propertyMixers = defaultAction._propertyBindings || []
            propertyMixers.forEach((binding, index) => {
                if (binding && binding.binding && binding.binding.path) {
                    const path = binding.binding.path
                    if (path.includes('morphTargetInfluences')) {
                        binding.binding.setValue = () => {} // Disable this binding
                        console.log(`🔇 Disabled morph target binding in animation: ${path}`)
                    }
                }
            })
            
            defaultAction.play()
            defaultActionRef.current = defaultAction
            console.log(`🎬 Playing default animation continuously: ${defaultClip.name}`)
        } else {
            console.log('ℹ️ No animations found in GLB file - avatar may show T-pose')
        }

        // Helper function to filter out morph target tracks from animations
        const filterMorphTracks = (clip) => {
            const filteredTracks = clip.tracks.filter(track => {
                const isMorphTrack = track.name && (
                    track.name.includes('.morphTargetInfluences') ||
                    track.name.toLowerCase().includes('viseme') ||
                    track.name.toLowerCase().includes('mouth') ||
                    track.name.toLowerCase().includes('jaw')
                )
                return !isMorphTrack
            })
            
            if (filteredTracks.length < clip.tracks.length) {
                console.log(`🔇 Filtered ${clip.tracks.length - filteredTracks.length} morph tracks from ${clip.name}`)
                return new THREE.AnimationClip(clip.name, clip.duration, filteredTracks)
            }
            return clip
        }
        
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
            let clip = fbx.animations[0]
            if (clip) {
                // Filter morph tracks first
                clip = filterMorphTracks(clip)
                
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(clip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.salute = filterMorphTracks(retargetedClip || clip)
                    console.log('✅ Salute animation ready:', animationsRef.current.salute.name, animationsRef.current.salute.duration, 'seconds')
                } else {
                    animationsRef.current.salute = clip
                    console.log('✅ Salute animation loaded (no skeleton for retargeting):', clip.name, clip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Salute.fbx:', error)
        })

        // Load Offensive Idle animation
        loader.load('/models/Offensive Idle.fbx', (fbx) => {
            let clip = fbx.animations[0]
            if (clip) {
                // Filter morph tracks first
                clip = filterMorphTracks(clip)
                
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(clip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.offensiveIdle = filterMorphTracks(retargetedClip || clip)
                    console.log('✅ Offensive Idle animation ready:', animationsRef.current.offensiveIdle.name, animationsRef.current.offensiveIdle.duration, 'seconds')
                } else {
                    animationsRef.current.offensiveIdle = clip
                    console.log('✅ Offensive Idle animation loaded (no skeleton for retargeting):', clip.name, clip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Offensive Idle.fbx:', error)
        })

        // Load Yelling While Standing animation
        loader.load('/models/Yelling While Standing.fbx', (fbx) => {
            let clip = fbx.animations[0]
            if (clip) {
                // Filter morph tracks first
                clip = filterMorphTracks(clip)
                
                if (avatarSkeletonRef.current) {
                    const retargetedClip = retargetAnimation(clip, fbx, avatarSkeletonRef.current)
                    animationsRef.current.yelling = filterMorphTracks(retargetedClip || clip)
                    console.log('✅ Yelling While Standing animation ready:', animationsRef.current.yelling.name, animationsRef.current.yelling.duration, 'seconds')
                } else {
                    animationsRef.current.yelling = clip
                    console.log('✅ Yelling While Standing animation loaded (no skeleton for retargeting):', clip.name, clip.duration, 'seconds')
                }
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Yelling While Standing.fbx:', error)
        })

    }, [scene])

    // Find bones for micro-motion after skeleton is ready
    useEffect(() => {
        if (!avatarSkeletonRef.current) return
        const bones = avatarSkeletonRef.current.bones
        for (const bone of bones) {
            const name = bone.name.toLowerCase()
            if (name.includes('head') && !name.includes('end')) headBoneRef.current = bone
            if ((name.includes('spine1') || name.includes('spine2')) && !spineBoneRef.current) spineBoneRef.current = bone
            if (name.includes('neck') && !name.includes('end')) neckBoneRef.current = bone
        }
        if (headBoneRef.current) console.log('✅ Head bone for micro-motion:', headBoneRef.current.name)
        if (spineBoneRef.current) console.log('✅ Spine bone for breathing:', spineBoneRef.current.name)
    }, [scene])

    // ===== LOAD SITTING IDLE + SITTING TALKING FBX ANIMATIONS =====
    useEffect(() => {
        if (!mixerRef.current) return

        const mixer = mixerRef.current
        const fbxLoader = new FBXLoader()

        const filterMorphTracksFromClip = (clip) => {
            const filteredTracks = clip.tracks.filter(track => {
                const isMorphTrack = track.name && (
                    track.name.includes('.morphTargetInfluences') ||
                    track.name.toLowerCase().includes('viseme') ||
                    track.name.toLowerCase().includes('mouth') ||
                    track.name.toLowerCase().includes('jaw')
                )
                return !isMorphTrack
            })
            return new THREE.AnimationClip(clip.name || 'filtered', clip.duration, filteredTracks)
        }

        // Load Sitting Idle
        fbxLoader.load('/models/Sitting Idle.fbx', (fbx) => {
            console.log('✅ Sitting Idle FBX loaded')

            if (fbx.animations && fbx.animations.length > 0) {
                const sittingClip = filterMorphTracksFromClip(fbx.animations[0])
                sittingClip.name = 'SittingIdle'
                console.log('✅ Sitting idle clip:', sittingClip.name, sittingClip.duration, 'seconds')

                // Stop default animation - avatar should stay sitting
                if (defaultActionRef.current) {
                    defaultActionRef.current.stop()
                }

                const sittingAction = mixer.clipAction(sittingClip)
                sittingAction.setLoop(THREE.LoopRepeat, Infinity)
                sittingAction.play()
                sittingActionRef.current = sittingAction
                console.log('🎬 Playing Sitting Idle animation (permanent)')
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Sitting Idle.fbx:', error)
        })

        // Load Talking
        fbxLoader.load('/models/Talking.fbx', (fbx) => {
            console.log('✅ Talking FBX loaded')

            if (fbx.animations && fbx.animations.length > 0) {
                const talkingClip = filterMorphTracksFromClip(fbx.animations[0])
                talkingClip.name = 'Talking'
                console.log('✅ Talking clip:', talkingClip.name, talkingClip.duration, 'seconds')

                const talkingAction = mixer.clipAction(talkingClip)
                talkingAction.setLoop(THREE.LoopRepeat, Infinity)
                talkingAction.setEffectiveWeight(0)
                talkingAction.play()
                sittingTalkingActionRef.current = talkingAction
                console.log('🎬 Talking animation ready (weight 0)')
            }
        }, undefined, (error) => {
            console.error('❌ Error loading Talking.fbx:', error)
        })

    }, [scene])

    // Keep sitting animations always running
    useEffect(() => {
        if (sittingActionRef.current && !sittingActionRef.current.isRunning()) {
            sittingActionRef.current.play()
        }
        if (sittingTalkingActionRef.current && !sittingTalkingActionRef.current.isRunning()) {
            sittingTalkingActionRef.current.play()
        }
    }, [animationType, audioElement, lipSyncData])

    // Update animation mixer every frame AND apply lip sync + facial expressions AFTER mixer
    // This is CRITICAL - lip sync MUST run after mixer.update() or mixer will overwrite our values!
    useFrame((state, delta) => {
        if (mixerRef.current) {
            const clampedDelta = Math.min(delta, 0.1)
            mixerRef.current.update(clampedDelta)
        }

        const elapsedTime = state.clock.elapsedTime
        const isAudioPlaying = audioElement && !audioElement.paused && !audioElement.ended
        const hasLipSyncData = lipSyncData && lipSyncData.mouthCues && lipSyncData.mouthCues.length > 0

        // Get real-time audio amplitude for lip sync modulation
        const amplitude = isAudioPlaying ? getAmplitude() : 0

        // ===== BLEND between Sitting Idle and Sitting Talking =====
        if (sittingActionRef.current && sittingTalkingActionRef.current) {
            const blendSpeed = 5.0 * delta
            const idleW = sittingActionRef.current.getEffectiveWeight()
            const talkW = sittingTalkingActionRef.current.getEffectiveWeight()

            if (isAudioPlaying) {
                sittingActionRef.current.setEffectiveWeight(Math.max(0, idleW - blendSpeed))
                sittingTalkingActionRef.current.setEffectiveWeight(Math.min(1, talkW + blendSpeed))
            } else {
                sittingTalkingActionRef.current.setEffectiveWeight(Math.max(0, talkW - blendSpeed))
                sittingActionRef.current.setEffectiveWeight(Math.min(1, idleW + blendSpeed))
            }
        }

        // ===== HELPER: apply morph target by name across all face meshes =====
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

        // --- Breathing: very subtle sine on spine bone Y (barely visible) ---
        if (spineBoneRef.current) {
            const breathCycle = Math.sin(elapsedTime * 0.4 * Math.PI * 2) // ~0.4 Hz — slow, natural
            spineBoneRef.current.position.y += breathCycle * 0.0006 // barely perceptible
        }

        // --- Head sway: layered sine on head bone rotation ---
        if (headBoneRef.current) {
            const headSwayX = Math.sin(elapsedTime * 0.3) * 0.015 + Math.sin(elapsedTime * 0.7) * 0.008 // ~1° nod
            const headSwayY = Math.sin(elapsedTime * 0.25 + 1.0) * 0.012 + Math.sin(elapsedTime * 0.6 + 0.5) * 0.006 // ~0.8° turn
            const headSwayZ = Math.sin(elapsedTime * 0.2 + 2.0) * 0.005 // very subtle tilt

            // Speaking head nod — emphatic dip on vowel phonemes
            headNodRef.current += headNodVelocityRef.current * delta
            headNodVelocityRef.current *= 0.92 // damping
            if (Math.abs(headNodRef.current) < 0.001) headNodRef.current = 0

            headBoneRef.current.rotation.x += headSwayX + headNodRef.current
            headBoneRef.current.rotation.y += headSwayY
            headBoneRef.current.rotation.z += headSwayZ
        }

        // --- Shoulder micro-shift ---
        if (neckBoneRef.current) {
            const shoulderShift = Math.sin(elapsedTime * 0.35 + 1.5) * 0.004
            neckBoneRef.current.rotation.z += shoulderShift
        }

        // ===== 1. EYE BLINKING SYSTEM (always active) =====
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
                const nextInterval = isDoubleBlink ? 0.25 : (2 + Math.random() * 4)
                nextBlinkTimeRef.current = elapsedTime + nextInterval
            }
        } else {
            applyMorph('eyeBlinkLeft', 0, 0.3)
            applyMorph('eyeBlinkRight', 0, 0.3)
        }

        // ===== EYE SACCADES + LOOK-AT =====
        if (elapsedTime >= nextSaccadeTimeRef.current) {
            // New random eye target
            saccadeTargetRef.current = {
                x: (Math.random() - 0.5) * 0.15, // small horizontal range
                y: (Math.random() - 0.5) * 0.08  // smaller vertical range
            }
            nextSaccadeTimeRef.current = elapsedTime + 0.5 + Math.random() * 2.0
        }

        // Apply eye look direction via morph targets
        const eyeX = saccadeTargetRef.current.x
        const eyeY = saccadeTargetRef.current.y
        const eyeSpeed = 0.12 // smooth tracking

        // Horizontal look
        if (eyeX > 0) {
            applyMorph('eyeLookOutLeft', eyeX, eyeSpeed)
            applyMorph('eyeLookInRight', eyeX, eyeSpeed)
            applyMorph('eyeLookInLeft', 0, eyeSpeed)
            applyMorph('eyeLookOutRight', 0, eyeSpeed)
        } else {
            applyMorph('eyeLookInLeft', -eyeX, eyeSpeed)
            applyMorph('eyeLookOutRight', -eyeX, eyeSpeed)
            applyMorph('eyeLookOutLeft', 0, eyeSpeed)
            applyMorph('eyeLookInRight', 0, eyeSpeed)
        }

        // Vertical look
        if (eyeY > 0) {
            applyMorph('eyeLookUpLeft', eyeY, eyeSpeed)
            applyMorph('eyeLookUpRight', eyeY, eyeSpeed)
            applyMorph('eyeLookDownLeft', 0, eyeSpeed)
            applyMorph('eyeLookDownRight', 0, eyeSpeed)
        } else {
            applyMorph('eyeLookDownLeft', -eyeY, eyeSpeed)
            applyMorph('eyeLookDownRight', -eyeY, eyeSpeed)
            applyMorph('eyeLookUpLeft', 0, eyeSpeed)
            applyMorph('eyeLookUpRight', 0, eyeSpeed)
        }

        // ===== 2. LIP SYNC + EXPRESSIONS WHILE SPEAKING =====
        if (isAudioPlaying) {
            const currentTime = audioElement.currentTime || 0

            // Find current phoneme
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

            // Amplitude modulation factor (makes lip sync responsive to volume)
            const ampMod = 0.6 + amplitude * 0.5 // range: 0.6 (quiet) to 1.1 (loud)

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

                    // Mouth shape indices
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

                    // Mouth targets
                    let targets = {
                        mouthOpen: 0, jaw: 0, PP: 0, FF: 0, TH: 0, O: 0, E: 0,
                        AA: 0, I: 0, U: 0, KK: 0, CH: 0, SS: 0, NN: 0, RR: 0, DD: 0
                    }

                    if (currentCue) {
                        const phoneme = currentCue.value

                        switch (phoneme) {
                            case 'A':
                                targets.mouthOpen = 0.4; targets.jaw = 0.35; targets.AA = 0.5
                                break
                            case 'B':
                                targets.mouthOpen = 0.05; targets.jaw = 0.05; targets.PP = 0.6
                                break
                            case 'C':
                                targets.mouthOpen = 0.25; targets.jaw = 0.15; targets.E = 0.4
                                break
                            case 'D':
                                targets.mouthOpen = 0.35; targets.jaw = 0.3; targets.AA = 0.45; targets.DD = 0.3
                                break
                            case 'E':
                                targets.mouthOpen = 0.15; targets.jaw = 0.1; targets.E = 0.5; targets.I = 0.3
                                break
                            case 'F':
                                targets.mouthOpen = 0.1; targets.jaw = 0.08; targets.FF = 0.6
                                break
                            case 'G':
                                targets.mouthOpen = 0.3; targets.jaw = 0.25; targets.O = 0.5; targets.U = 0.2
                                break
                            case 'H':
                                targets.mouthOpen = 0.2; targets.jaw = 0.15; targets.TH = 0.3; targets.NN = 0.2
                                break
                            case 'X':
                            default:
                                targets.mouthOpen = 0.02; targets.jaw = 0.01
                                break
                        }

                        // Apply amplitude modulation — louder = wider mouth
                        targets.mouthOpen *= ampMod
                        targets.jaw *= ampMod

                        // === COARTICULATION: blend with previous 2 phonemes ===
                        if (prevCueRef.current && prevCueRef.current !== phoneme) {
                            // Trigger head nod on emphasized vowels
                            if (['A', 'D', 'G'].includes(phoneme) && !['A', 'D', 'G'].includes(prevCueRef.current)) {
                                headNodVelocityRef.current = -0.08 // downward dip
                            }
                        }
                        prevCue2Ref.current = prevCueRef.current
                        prevCueRef.current = phoneme
                    } else {
                        // FALLBACK: No lip sync data - use natural talking animation
                        const wave1 = Math.sin(currentTime * 10) * 0.5 + 0.5
                        const wave2 = Math.sin(currentTime * 15) * 0.5 + 0.5
                        const wave3 = Math.sin(currentTime * 7) * 0.5 + 0.5
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
                            targets.mouthOpen = (0.1 + wave3 * 0.15) * ampMod
                            targets.jaw = 0.1 * wave3
                        }
                    }

                    // === JAW BOUNCE PHYSICS ===
                    const currentJawTarget = targets.jaw
                    const jawDelta = currentJawTarget - prevJawOpenRef.current
                    if (Math.abs(jawDelta) > 0.15) {
                        // Large jaw change — add elastic bounce
                        jawVelocityRef.current += jawDelta * 0.3
                    }
                    jawBounceRef.current += jawVelocityRef.current * delta * 10
                    jawVelocityRef.current *= 0.85 // damping
                    jawBounceRef.current *= 0.9 // decay
                    targets.jaw += jawBounceRef.current * 0.05
                    prevJawOpenRef.current = currentJawTarget

                    // === DIRECTIONAL INTERPOLATION WITH OVERSHOOT ===
                    const applySmooth = (idx, target) => {
                        if (idx !== undefined && idx < infl.length) {
                            const current = infl[idx] || 0
                            const diff = target - current
                            // Faster opening (0.45), slower closing (0.15) for natural speech
                            const speed = diff > 0 ? 0.45 : 0.15
                            let newValue = current + diff * speed
                            // Slight overshoot on large upward movements
                            if (diff > 0.1) {
                                newValue += diff * 0.05 * Math.sin(elapsedTime * 20) // subtle elastic
                            }
                            infl[idx] = Math.max(0, Math.min(1, newValue))
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

                    if (infl.length > 0) {
                        const current = infl[0] || 0
                        const speed = targets.mouthOpen > current ? 0.45 : 0.15
                        infl[0] = current + (targets.mouthOpen - current) * speed
                    }
                }
            })

            // === EYEBROW MICRO-MOVEMENTS during speech ===
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
                    applyMorph('browOuterUpLeft', 0, 0.08)
                    applyMorph('browOuterUpRight', 0, 0.08)
                } else {
                    applyMorph('browInnerUp', 0.03, 0.06)
                    applyMorph('browOuterUpLeft', 0.02, 0.06)
                    applyMorph('browOuterUpRight', 0.02, 0.06)
                    applyMorph('browDownLeft', 0, 0.06)
                    applyMorph('browDownRight', 0, 0.06)
                }
            }

            // === SUBTLE SMILE + CHEEK SQUINT while speaking ===
            applyMorph('mouthSmileLeft', 0.1 + amplitude * 0.06, 0.06)
            applyMorph('mouthSmileRight', 0.1 + amplitude * 0.06, 0.06)
            applyMorph('cheekSquintLeft', 0.05 + amplitude * 0.03, 0.06)
            applyMorph('cheekSquintRight', 0.05 + amplitude * 0.03, 0.06)

        } else if (!audioElement || audioElement.paused || audioElement.ended) {
            // ===== 3. IDLE STATE: smooth mouth close + micro-movements =====
            prevCueRef.current = null
            prevCue2Ref.current = null

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

            // === IDLE MICRO-MOVEMENTS ===
            // Subtle breathing: very slow sine wave on jawOpen
            const breathValue = (Math.sin(elapsedTime * 1.5) * 0.5 + 0.5) * 0.015
            applyMorph('jawOpen', breathValue, 0.1)

            // Occasional micro eye-squint
            const squintWave = (Math.sin(elapsedTime * 0.7) * 0.5 + 0.5) * 0.03
            applyMorph('eyeSquintLeft', squintWave, 0.05)
            applyMorph('eyeSquintRight', squintWave, 0.05)

            // === IDLE MICRO-EXPRESSIONS ===
            if (elapsedTime >= nextMicroExpressionRef.current) {
                // Pick a random micro-expression
                const types = ['smile', 'browRaise', 'squint', null, null] // null = no expression
                microExpressionTypeRef.current = types[Math.floor(Math.random() * types.length)]
                microExpressionProgressRef.current = 0
                nextMicroExpressionRef.current = elapsedTime + 4 + Math.random() * 6
            }

            if (microExpressionTypeRef.current) {
                microExpressionProgressRef.current += delta
                const dur = 2.5 // expression duration
                const p = microExpressionProgressRef.current / dur
                // Bell curve: peaks at 0.5, fades to 0 at 0 and 1
                const intensity = Math.sin(Math.min(p, 1) * Math.PI) * 0.15

                switch (microExpressionTypeRef.current) {
                    case 'smile':
                        applyMorph('mouthSmileLeft', intensity, 0.08)
                        applyMorph('mouthSmileRight', intensity, 0.08)
                        applyMorph('cheekSquintLeft', intensity * 0.4, 0.08)
                        applyMorph('cheekSquintRight', intensity * 0.4, 0.08)
                        break
                    case 'browRaise':
                        applyMorph('browInnerUp', intensity, 0.06)
                        applyMorph('browOuterUpLeft', intensity * 0.7, 0.06)
                        applyMorph('browOuterUpRight', intensity * 0.7, 0.06)
                        break
                    case 'squint':
                        applyMorph('eyeSquintLeft', intensity, 0.06)
                        applyMorph('eyeSquintRight', intensity, 0.06)
                        break
                }

                if (p >= 1) microExpressionTypeRef.current = null
            }

            // Slowly reset expression morphs
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

    // Re-enable useLipSync hook for phoneme-based lip sync
    useLipSync(headRef)

    return (
        <group ref={groupRef} position={[0, 0.9, -2]}>
            <primitive
                object={scene}
                scale={1.5}
                position={[0, -1.3, 1]}
            />
        </group>
    )
}

useGLTF.preload('/models/avtarr.glb')
