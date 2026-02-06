import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Victorian-era study/library environment for Ada Lovelace
export default function VictorianEnvironment() {
    const candleLight1Ref = useRef()
    const candleLight2Ref = useRef()
    const candleFlame1Ref = useRef()
    const candleFlame2Ref = useRef()
    
    // Animate candle flames flickering
    useFrame((state) => {
        const time = state.clock.elapsedTime
        
        // Flickering candle lights
        if (candleLight1Ref.current) {
            candleLight1Ref.current.intensity = 3 + Math.sin(time * 8) * 0.5 + Math.sin(time * 13) * 0.3
        }
        if (candleLight2Ref.current) {
            candleLight2Ref.current.intensity = 3 + Math.sin(time * 9 + 1) * 0.5 + Math.sin(time * 11) * 0.3
        }
        
        // Flame animation
        if (candleFlame1Ref.current) {
            candleFlame1Ref.current.scale.y = 1 + Math.sin(time * 10) * 0.1
            candleFlame1Ref.current.rotation.z = Math.sin(time * 7) * 0.1
        }
        if (candleFlame2Ref.current) {
            candleFlame2Ref.current.scale.y = 1 + Math.sin(time * 12 + 0.5) * 0.1
            candleFlame2Ref.current.rotation.z = Math.sin(time * 8) * 0.1
        }
    })
    
    // Victorian color palette - BRIGHT VERSION
    const colors = {
        darkWood: '#5c3a2e',
        mediumWood: '#8b6914',
        lightWood: '#a67c52',
        wallpaper: '#4a6b4a', // Lighter Victorian green wallpaper
        wallpaperAccent: '#5d7d5d',
        gold: '#d4a017',
        brass: '#daa520',
        cream: '#fffef0',
        burgundy: '#a52a2a',
        leather: '#6b4423',
    }

    return (
        <group position={[0, 0, 0]}>
            {/* ===== FLOOR - Old wooden planks ===== */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                <planeGeometry args={[12, 12]} />
                <meshStandardMaterial 
                    color={colors.mediumWood}
                    roughness={0.8}
                    metalness={0.1}
                />
            </mesh>
            
            {/* Floor wood grain lines */}
            {[-2, -1, 0, 1, 2].map((x, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x * 1.2, -0.49, 0]}>
                    <planeGeometry args={[0.02, 12]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
            ))}
            
            {/* ===== BACK WALL - Victorian wallpaper ===== */}
            <mesh position={[0, 1.5, -4]} receiveShadow>
                <planeGeometry args={[12, 5]} />
                <meshStandardMaterial 
                    color={colors.wallpaper}
                    roughness={0.9}
                    metalness={0}
                />
            </mesh>
            
            {/* Wallpaper decorative pattern - vertical stripes */}
            {[-4, -2, 0, 2, 4].map((x, i) => (
                <mesh key={i} position={[x, 1.5, -3.98]}>
                    <planeGeometry args={[0.15, 5]} />
                    <meshStandardMaterial color={colors.wallpaperAccent} />
                </mesh>
            ))}
            
            {/* ===== LEFT WALL ===== */}
            <mesh position={[-5, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5]} />
                <meshStandardMaterial 
                    color={colors.wallpaper}
                    roughness={0.9}
                />
            </mesh>
            
            {/* ===== RIGHT WALL ===== */}
            <mesh position={[5, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5]} />
                <meshStandardMaterial 
                    color={colors.wallpaper}
                    roughness={0.9}
                />
            </mesh>
            
            {/* ===== WAINSCOTING (Wood paneling on lower walls) ===== */}
            <mesh position={[0, 0.25, -3.95]}>
                <boxGeometry args={[12, 1.5, 0.1]} />
                <meshStandardMaterial color={colors.darkWood} roughness={0.7} />
            </mesh>
            
            {/* Wainscoting details */}
            {[-4, -2, 0, 2, 4].map((x, i) => (
                <mesh key={i} position={[x, 0.25, -3.9]}>
                    <boxGeometry args={[0.08, 1.4, 0.05]} />
                    <meshStandardMaterial color={colors.lightWood} />
                </mesh>
            ))}
            
            {/* ===== BOOKSHELF - Left side ===== */}
            <group position={[-3.5, 0.5, -3.5]}>
                {/* Main bookshelf frame */}
                <mesh position={[0, 1, 0]}>
                    <boxGeometry args={[2, 3, 0.5]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Shelves */}
                {[0, 0.7, 1.4, 2.1].map((y, i) => (
                    <mesh key={i} position={[0, y, 0.05]}>
                        <boxGeometry args={[1.9, 0.05, 0.45]} />
                        <meshStandardMaterial color={colors.mediumWood} />
                    </mesh>
                ))}
                
                {/* Books on shelves */}
                {[0.3, 0.7, 1.1, 1.5, 1.9].map((y, row) => (
                    <group key={row} position={[0, y, 0.1]}>
                        {[-0.7, -0.4, -0.1, 0.2, 0.5].map((x, i) => (
                            <mesh key={i} position={[x, 0.15, 0]}>
                                <boxGeometry args={[0.15, 0.35 + Math.random() * 0.1, 0.25]} />
                                <meshStandardMaterial 
                                    color={['#8B0000', '#006400', '#4B0082', '#8B4513', '#2F4F4F'][i]}
                                    roughness={0.8}
                                />
                            </mesh>
                        ))}
                    </group>
                ))}
                
                {/* Decorative top */}
                <mesh position={[0, 2.6, 0]}>
                    <boxGeometry args={[2.2, 0.15, 0.6]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
            </group>
            
            {/* ===== BOOKSHELF - Right side ===== */}
            <group position={[3.5, 0.5, -3.5]}>
                {/* Main bookshelf frame */}
                <mesh position={[0, 1, 0]}>
                    <boxGeometry args={[2, 3, 0.5]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Shelves */}
                {[0, 0.7, 1.4, 2.1].map((y, i) => (
                    <mesh key={i} position={[0, y, 0.05]}>
                        <boxGeometry args={[1.9, 0.05, 0.45]} />
                        <meshStandardMaterial color={colors.mediumWood} />
                    </mesh>
                ))}
                
                {/* Books on shelves */}
                {[0.3, 0.7, 1.1, 1.5, 1.9].map((y, row) => (
                    <group key={row} position={[0, y, 0.1]}>
                        {[-0.7, -0.4, -0.1, 0.2, 0.5].map((x, i) => (
                            <mesh key={i} position={[x, 0.15, 0]}>
                                <boxGeometry args={[0.15, 0.35 + Math.random() * 0.1, 0.25]} />
                                <meshStandardMaterial 
                                    color={['#800000', '#556B2F', '#483D8B', '#A0522D', '#2F4F4F'][i]}
                                    roughness={0.8}
                                />
                            </mesh>
                        ))}
                    </group>
                ))}
                
                {/* Decorative top */}
                <mesh position={[0, 2.6, 0]}>
                    <boxGeometry args={[2.2, 0.15, 0.6]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
            </group>
            
            {/* ===== WINDOW - Center back wall ===== */}
            <group position={[0, 2, -3.9]}>
                {/* Window frame */}
                <mesh>
                    <boxGeometry args={[1.8, 2.2, 0.1]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
                
                {/* Window glass (slightly glowing - moonlight) */}
                <mesh position={[0, 0, 0.06]}>
                    <planeGeometry args={[1.5, 1.9]} />
                    <meshStandardMaterial 
                        color="#1a1a2e"
                        emissive="#0a0a15"
                        emissiveIntensity={0.3}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
                
                {/* Window cross bars */}
                <mesh position={[0, 0, 0.07]}>
                    <boxGeometry args={[1.5, 0.05, 0.02]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
                <mesh position={[0, 0, 0.07]}>
                    <boxGeometry args={[0.05, 1.9, 0.02]} />
                    <meshStandardMaterial color={colors.darkWood} />
                </mesh>
                
                {/* Curtains - Left */}
                <mesh position={[-1.1, 0, 0.1]}>
                    <boxGeometry args={[0.4, 2.4, 0.05]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.9} />
                </mesh>
                
                {/* Curtains - Right */}
                <mesh position={[1.1, 0, 0.1]}>
                    <boxGeometry args={[0.4, 2.4, 0.05]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.9} />
                </mesh>
                
                {/* Curtain rod */}
                <mesh position={[0, 1.3, 0.15]}>
                    <cylinderGeometry args={[0.03, 0.03, 2.8, 8]} rotation={[0, 0, Math.PI / 2]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
            </group>
            
            {/* ===== DESK - Victorian writing desk ===== */}
            <group position={[2.5, 0, 1]}>
                {/* Desk top */}
                <mesh position={[0, 0.75, 0]}>
                    <boxGeometry args={[1.5, 0.08, 0.8]} />
                    <meshStandardMaterial color={colors.mediumWood} roughness={0.5} />
                </mesh>
                
                {/* Desk legs */}
                {[[-0.65, -0.3], [-0.65, 0.3], [0.65, -0.3], [0.65, 0.3]].map(([x, z], i) => (
                    <mesh key={i} position={[x, 0.35, z]}>
                        <boxGeometry args={[0.1, 0.7, 0.1]} />
                        <meshStandardMaterial color={colors.darkWood} />
                    </mesh>
                ))}
                
                {/* Papers on desk */}
                <mesh position={[0, 0.8, 0]} rotation={[0, 0.1, 0]}>
                    <boxGeometry args={[0.4, 0.01, 0.5]} />
                    <meshStandardMaterial color={colors.cream} />
                </mesh>
                <mesh position={[-0.3, 0.81, 0.1]} rotation={[0, -0.2, 0]}>
                    <boxGeometry args={[0.3, 0.01, 0.4]} />
                    <meshStandardMaterial color="#f0e6d3" />
                </mesh>
                
                {/* Quill pen holder */}
                <mesh position={[0.5, 0.85, -0.2]}>
                    <cylinderGeometry args={[0.04, 0.05, 0.12, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                
                {/* Ink bottle */}
                <mesh position={[0.4, 0.82, 0.2]}>
                    <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
            </group>
            
            {/* ===== CANDELABRA - Left ===== */}
            <group position={[-2, 0, -2]}>
                {/* Candle stand base */}
                <mesh position={[0, 0.4, 0]}>
                    <cylinderGeometry args={[0.15, 0.2, 0.1, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.6, 0]}>
                    <cylinderGeometry args={[0.03, 0.05, 0.4, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                
                {/* Candle */}
                <mesh position={[0, 0.95, 0]}>
                    <cylinderGeometry args={[0.025, 0.03, 0.3, 8]} />
                    <meshStandardMaterial color={colors.cream} />
                </mesh>
                
                {/* Flame */}
                <mesh ref={candleFlame1Ref} position={[0, 1.15, 0]}>
                    <coneGeometry args={[0.02, 0.06, 8]} />
                    <meshBasicMaterial color="#ff6600" />
                </mesh>
                
                {/* Candle light */}
                <pointLight
                    ref={candleLight1Ref}
                    position={[0, 1.2, 0]}
                    color="#ffcc88"
                    intensity={3}
                    distance={8}
                    decay={1.5}
                />
            </group>
            
            {/* ===== CANDELABRA - Right ===== */}
            <group position={[2, 0, -2]}>
                {/* Candle stand base */}
                <mesh position={[0, 0.4, 0]}>
                    <cylinderGeometry args={[0.15, 0.2, 0.1, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.6, 0]}>
                    <cylinderGeometry args={[0.03, 0.05, 0.4, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                
                {/* Candle */}
                <mesh position={[0, 0.95, 0]}>
                    <cylinderGeometry args={[0.025, 0.03, 0.3, 8]} />
                    <meshStandardMaterial color={colors.cream} />
                </mesh>
                
                {/* Flame */}
                <mesh ref={candleFlame2Ref} position={[0, 1.15, 0]}>
                    <coneGeometry args={[0.02, 0.06, 8]} />
                    <meshBasicMaterial color="#ff6600" />
                </mesh>
                
                {/* Candle light */}
                <pointLight
                    ref={candleLight2Ref}
                    position={[0, 1.2, 0]}
                    color="#ffcc88"
                    intensity={3}
                    distance={8}
                    decay={1.5}
                />
            </group>
            
            {/* ===== GRANDFATHER CLOCK - Left wall ===== */}
            <group position={[-4.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                {/* Clock body */}
                <mesh position={[0, 1.2, 0]}>
                    <boxGeometry args={[0.5, 2.4, 0.4]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Clock face */}
                <mesh position={[0, 1.8, 0.21]}>
                    <circleGeometry args={[0.18, 32]} />
                    <meshStandardMaterial color={colors.cream} />
                </mesh>
                
                {/* Clock frame */}
                <mesh position={[0, 1.8, 0.22]}>
                    <ringGeometry args={[0.17, 0.2, 32]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                
                {/* Clock hands */}
                <mesh position={[0, 1.8, 0.23]} rotation={[0, 0, Math.PI / 4]}>
                    <boxGeometry args={[0.01, 0.12, 0.01]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
                <mesh position={[0, 1.8, 0.23]} rotation={[0, 0, Math.PI / 1.5]}>
                    <boxGeometry args={[0.01, 0.08, 0.01]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
                
                {/* Pendulum window */}
                <mesh position={[0, 0.7, 0.21]}>
                    <planeGeometry args={[0.25, 0.6]} />
                    <meshStandardMaterial color="#1a1a2e" transparent opacity={0.5} />
                </mesh>
            </group>
            
            {/* ===== GLOBE - On desk ===== */}
            <group position={[3.2, 0.85, 0.8]}>
                <mesh>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshStandardMaterial 
                        color="#4a6741"
                        roughness={0.6}
                    />
                </mesh>
                {/* Globe stand */}
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.02, 0.06, 0.08, 8]} />
                    <meshStandardMaterial color={colors.brass} metalness={0.6} roughness={0.4} />
                </mesh>
            </group>
            
            {/* ===== PORTRAIT FRAME - Back wall ===== */}
            <group position={[-1.5, 2.5, -3.85]}>
                <mesh>
                    <boxGeometry args={[0.8, 1, 0.05]} />
                    <meshStandardMaterial color={colors.gold} metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.03]}>
                    <planeGeometry args={[0.65, 0.85]} />
                    <meshStandardMaterial color="#2d2d2d" />
                </mesh>
            </group>
            
            {/* ===== PERSIAN RUG ===== */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0.5]}>
                <planeGeometry args={[3, 4]} />
                <meshStandardMaterial 
                    color={colors.burgundy}
                    roughness={0.95}
                />
            </mesh>
            {/* Rug border */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0.5]}>
                <ringGeometry args={[1.4, 1.5, 4]} />
                <meshStandardMaterial color={colors.gold} />
            </mesh>
            
            {/* ===== VICTORIAN ARMCHAIR - For intro animation ===== */}
            <group position={[0, -0.5, -2.5]} scale={[1.8, 1.5, 1.5]}>
                {/* Chair seat */}
                <mesh position={[0, 0.35, 0]}>
                    <boxGeometry args={[0.8, 0.12, 0.7]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.8} />
                </mesh>
                
                {/* Chair back */}
                <mesh position={[0, 0.85, -0.3]}>
                    <boxGeometry args={[0.8, 1.0, 0.1]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.8} />
                </mesh>
                
                {/* Chair back top curve */}
                <mesh position={[0, 1.4, -0.3]}>
                    <boxGeometry args={[0.9, 0.15, 0.12]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Chair armrests - wider apart */}
                <mesh position={[-0.5, 0.55, 0]}>
                    <boxGeometry args={[0.1, 0.3, 0.6]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.5, 0.55, 0]}>
                    <boxGeometry args={[0.1, 0.3, 0.6]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Armrest tops */}
                <mesh position={[-0.5, 0.72, 0]}>
                    <boxGeometry args={[0.15, 0.05, 0.65]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.5, 0.72, 0]}>
                    <boxGeometry args={[0.15, 0.05, 0.65]} />
                    <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                </mesh>
                
                {/* Chair legs */}
                {[[-0.35, -0.28], [-0.35, 0.28], [0.35, -0.28], [0.35, 0.28]].map(([x, z], i) => (
                    <mesh key={i} position={[x, 0.15, z]}>
                        <boxGeometry args={[0.08, 0.4, 0.08]} />
                        <meshStandardMaterial color={colors.darkWood} roughness={0.6} />
                    </mesh>
                ))}
                
                {/* Cushion */}
                <mesh position={[0, 0.45, 0.05]}>
                    <boxGeometry args={[0.7, 0.1, 0.6]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.9} />
                </mesh>
                
                {/* Back cushion */}
                <mesh position={[0, 0.8, -0.22]}>
                    <boxGeometry args={[0.65, 0.7, 0.1]} />
                    <meshStandardMaterial color={colors.burgundy} roughness={0.9} />
                </mesh>
            </group>
            
            {/* ===== BRIGHT LIGHTING FOR VISIBILITY ===== */}
            {/* Strong ambient light */}
            <ambientLight intensity={0.8} color="#fff5e6" />
            
            {/* Main front light - illuminates the avatar */}
            <directionalLight 
                position={[0, 5, 5]} 
                intensity={1.5} 
                color="#ffffff"
                castShadow
            />
            
            {/* Back fill light */}
            <directionalLight 
                position={[0, 3, -3]} 
                intensity={0.8} 
                color="#ffeedd"
            />
            
            {/* Left fill light */}
            <pointLight 
                position={[-4, 3, 0]} 
                intensity={1} 
                color="#fff8f0"
                distance={12}
            />
            
            {/* Right fill light */}
            <pointLight 
                position={[4, 3, 0]} 
                intensity={1} 
                color="#fff8f0"
                distance={12}
            />
            
            {/* Top light */}
            <pointLight 
                position={[0, 4, 0]} 
                intensity={0.8} 
                color="#ffffff"
                distance={10}
            />
        </group>
    )
}
