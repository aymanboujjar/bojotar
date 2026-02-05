import { useGLTF } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { useLipSync } from '../hooks/useLipSync'
import { useLipSyncContext } from '../contexts/LipSyncContext'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Avatar() {
    const { scene, animations } = useGLTF('/models/avtarr.glb')
    const headRef = useRef()
    const groupRef = useRef()
    const mixerRef = useRef(null)
    const currentActionRef = useRef(null)
    const defaultActionRef = useRef(null)
    const nextActionRef = useRef(null)
    const avatarSkeletonRef = useRef(null)
    const { animationType, audioElement, lipSyncData, setMorphTargetDictionary } = useLipSyncContext()
    const animationsRef = useRef({
        salute: null,
        offensiveIdle: null,
        yelling: null
    })
    const saluteEndCheckRef = useRef(null)

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

    // Handle animation changes based on animationType and lipSyncData
    // Keep default animation running, only add external animations if specified
    useEffect(() => {
        if (!mixerRef.current) return

        const mixer = mixerRef.current
        const externalAnimations = animationsRef.current
        
        // Ensure default animation is always playing (prevents T-pose)
        if (defaultActionRef.current && !defaultActionRef.current.isRunning()) {
            defaultActionRef.current.play()
            console.log('🎬 Restarted default animation')
        }

        // Only add external animations when we have audio and need specific animations
        if (audioElement && animationType) {
            // For thanks animation: Keep default animation, just ensure lip sync works
            if (animationType === 'thanks') {
                // Keep default animation running - don't override
                console.log('🎬 Using default animation with lip sync')
            } else if (animationType === 'tzaghrita') {
                // Clean up previous animation check
                if (saluteEndCheckRef.current) {
                    cancelAnimationFrame(saluteEndCheckRef.current)
                    saluteEndCheckRef.current = null
                }

                // Fade out default animation smoothly
                if (defaultActionRef.current && defaultActionRef.current.isRunning()) {
                    defaultActionRef.current.fadeOut(0.3)
                }

                // Fade out current animation if switching
                if (currentActionRef.current && currentActionRef.current !== defaultActionRef.current) {
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
                if (externalAnimations.yelling) {
                    const yellingAction = mixer.clipAction(externalAnimations.yelling)
                    yellingAction.reset()
                    yellingAction.setLoop(THREE.LoopRepeat, Infinity)
                    yellingAction.setEffectiveTimeScale(1.0)
                    yellingAction.setEffectiveWeight(1.0)
                    yellingAction.time = 0
                    
                    // Disable morph target bindings for this animation too
                    const propertyMixers = yellingAction._propertyBindings || []
                    propertyMixers.forEach((binding) => {
                        if (binding && binding.binding && binding.binding.path && 
                            binding.binding.path.includes('morphTargetInfluences')) {
                            binding.binding.setValue = () => {}
                        }
                    })
                    
                    yellingAction.fadeIn(0.3)
                    yellingAction.play()
                    currentActionRef.current = yellingAction
                    console.log('🎬 Playing Yelling While Standing animation (morph targets disabled for lip sync)')
                }
            }

            // When audio ends, cleanup external animations but keep default running
            const handleAudioEnd = () => {
                if (saluteEndCheckRef.current) {
                    cancelAnimationFrame(saluteEndCheckRef.current)
                    saluteEndCheckRef.current = null
                }
                
                // Stop external animation if playing
                if (currentActionRef.current && currentActionRef.current !== defaultActionRef.current) {
                    currentActionRef.current.fadeOut(0.5)
                    setTimeout(() => {
                        if (currentActionRef.current) {
                            currentActionRef.current.stop()
                            currentActionRef.current.reset()
                            currentActionRef.current = null
                        }
                    }, 500)
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
                
                // Ensure default animation is still running
                if (defaultActionRef.current && !defaultActionRef.current.isRunning()) {
                    defaultActionRef.current.play()
                    console.log('🎬 Resumed default animation after audio ended')
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
        } else {
            // No audio playing - ensure default animation is running
            if (defaultActionRef.current && !defaultActionRef.current.isRunning()) {
                defaultActionRef.current.play()
                console.log('🎬 Keeping default animation running')
            }
        }
    }, [animationType, audioElement, lipSyncData])

    // Update animation mixer every frame AND apply lip sync AFTER mixer
    // This is CRITICAL - lip sync MUST run after mixer.update() or mixer will overwrite our values!
    useFrame((state, delta) => {
        if (mixerRef.current) {
            // Clamp delta to prevent large jumps that can cause animation glitches
            const clampedDelta = Math.min(delta, 0.1) // Max 100ms per frame
            mixerRef.current.update(clampedDelta)
        }
        
        // ===== DIRECT LIP SYNC - Natural talking animation =====
        // Apply to ALL mouth meshes for combined effect
        scene.traverse((obj) => {
            if ((obj.isSkinnedMesh || obj.isMesh) && obj.morphTargetInfluences && obj.morphTargetInfluences.length > 0) {
                const infl = obj.morphTargetInfluences
                const dict = obj.morphTargetDictionary || {}
                
                // Find indices
                const hasStringKeys = Object.keys(dict).some(k => isNaN(k))
                let mouthOpenIdx = hasStringKeys ? dict['mouthOpen'] : 0
                let jawOpenIdx = hasStringKeys ? dict['jawOpen'] : (infl.length > 50 ? 49 : 16)
                
                // Check if audio is playing
                if (audioElement && !audioElement.paused && !audioElement.ended) {
                    const currentTime = audioElement.currentTime || 0
                    
                    // NATURAL talking animation - small, realistic movements
                    // Use multiple sine waves for organic movement
                    const wave1 = Math.sin(currentTime * 12) * 0.5 + 0.5 // 0 to 1
                    const wave2 = Math.sin(currentTime * 18) * 0.5 + 0.5 // Faster variation
                    const combined = (wave1 * 0.7 + wave2 * 0.3) // Blend waves
                    
                    // NATURAL values - small movements like real talking (0.1 to 0.35 range)
                    const mouthValue = 0.1 + (combined * 0.25) // 0.1 to 0.35 - subtle open/close
                    const jawValue = 0.05 + (combined * 0.15) // 0.05 to 0.2 - subtle jaw movement
                    
                    // Apply natural mouth movement
                    if (mouthOpenIdx !== undefined && mouthOpenIdx < infl.length) {
                        infl[mouthOpenIdx] = mouthValue
                    }
                    if (jawOpenIdx !== undefined && jawOpenIdx < infl.length) {
                        infl[jawOpenIdx] = jawValue
                    }
                    // Also set index 0 (mouthOpen)
                    if (infl.length > 0) {
                        infl[0] = mouthValue
                    }
                } else {
                    // CLOSE MOUTH when audio stops - reset to 0
                    if (mouthOpenIdx !== undefined && mouthOpenIdx < infl.length) {
                        // Smooth closing
                        infl[mouthOpenIdx] = Math.max(0, (infl[mouthOpenIdx] || 0) * 0.8)
                    }
                    if (jawOpenIdx !== undefined && jawOpenIdx < infl.length) {
                        infl[jawOpenIdx] = Math.max(0, (infl[jawOpenIdx] || 0) * 0.8)
                    }
                    if (infl.length > 0) {
                        infl[0] = Math.max(0, (infl[0] || 0) * 0.8)
                    }
                }
            }
        })
    })

    // DISABLED: useLipSync hook - using direct lip sync above instead
    // useLipSync(headRef)

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

useGLTF.preload('/models/avtarr.glb')
