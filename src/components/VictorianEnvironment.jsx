import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Ada Lovelace's Victorian Library — immersive candlelit study
export default function VictorianEnvironment() {
    const candleLight1Ref = useRef()
    const candleLight2Ref = useRef()
    const candleLight3Ref = useRef()
    const candleFlame1Ref = useRef()
    const candleFlame2Ref = useRef()
    const candleFlame3Ref = useRef()
    const pendulumRef = useRef()
    const dust1Ref = useRef()
    const dust2Ref = useRef()
    const dust3Ref = useRef()
    const dust4Ref = useRef()

    // Animate candle flames, pendulum, dust motes
    useFrame((state) => {
        const time = state.clock.elapsedTime

        // Flickering candle lights
        if (candleLight1Ref.current) {
            candleLight1Ref.current.intensity = 5 + Math.sin(time * 8) * 0.8 + Math.sin(time * 13) * 0.5
        }
        if (candleLight2Ref.current) {
            candleLight2Ref.current.intensity = 5 + Math.sin(time * 9 + 1) * 0.8 + Math.sin(time * 11) * 0.5
        }
        if (candleLight3Ref.current) {
            candleLight3Ref.current.intensity = 4 + Math.sin(time * 7 + 2) * 0.6 + Math.sin(time * 14) * 0.4
        }

        // Flame sway
        if (candleFlame1Ref.current) {
            candleFlame1Ref.current.scale.y = 1 + Math.sin(time * 10) * 0.15
            candleFlame1Ref.current.rotation.z = Math.sin(time * 7) * 0.12
        }
        if (candleFlame2Ref.current) {
            candleFlame2Ref.current.scale.y = 1 + Math.sin(time * 12 + 0.5) * 0.15
            candleFlame2Ref.current.rotation.z = Math.sin(time * 8) * 0.12
        }
        if (candleFlame3Ref.current) {
            candleFlame3Ref.current.scale.y = 1 + Math.sin(time * 11 + 1) * 0.12
            candleFlame3Ref.current.rotation.z = Math.sin(time * 6) * 0.1
        }

        // Pendulum swing
        if (pendulumRef.current) {
            pendulumRef.current.rotation.z = Math.sin(time * 1.5) * 0.2
        }

        // Dust motes drifting near window
        const dustRefs = [dust1Ref, dust2Ref, dust3Ref, dust4Ref]
        dustRefs.forEach((ref, i) => {
            if (ref.current) {
                const offset = i * 1.7
                ref.current.position.x = -0.5 + Math.sin(time * 0.3 + offset) * 0.8
                ref.current.position.y = 2.0 + Math.sin(time * 0.2 + offset) * 0.6
                ref.current.position.z = -3.0 + Math.cos(time * 0.15 + offset) * 0.4
            }
        })
    })

    // Victorian color palette — deeper, richer tones
    const c = {
        darkWood: '#3d2517',
        medWood: '#6b4226',
        lightWood: '#8b6340',
        floorDark: '#5a3a24',
        floorLight: '#6d4830',
        wall: '#3a5a3a',
        wallAccent: '#4a6a4a',
        gold: '#b8860b',
        brass: '#c4972a',
        cream: '#f5f0e0',
        burgundy: '#7a1a1a',
        leather: '#5a3420',
        rugMain: '#6b1a1a',
        rugBorder: '#8b6914',
        rugInner: '#4a1010',
    }

    // Book colors for variety
    const bookColors = [
        '#5a0a0a', '#0a2a4a', '#1a3a1a', '#3a1a3a', '#5a3a0a',
        '#2a1a0a', '#0a3a3a', '#4a0a2a', '#3a3a0a', '#1a1a3a',
    ]

    // Helper: render a row of books on a shelf
    const BookRow = ({ y, xOffset = 0, count = 7 }) => (
        <group position={[xOffset, y, 0.08]}>
            {Array.from({ length: count }).map((_, i) => {
                const w = 0.08 + Math.sin(i * 7.3) * 0.04
                const h = 0.28 + Math.sin(i * 3.7) * 0.08
                const x = -0.7 + i * (1.4 / count)
                return (
                    <mesh key={i} position={[x, h / 2 + 0.02, 0]}>
                        <boxGeometry args={[w, h, 0.2]} />
                        <meshStandardMaterial
                            color={bookColors[i % bookColors.length]}
                            roughness={0.85}
                        />
                    </mesh>
                )
            })}
        </group>
    )

    // Helper: single candelabra
    const Candelabra = ({ position, lightRef, flameRef }) => (
        <group position={position}>
            {/* Base */}
            <mesh position={[0, -0.45, 0]}>
                <cylinderGeometry args={[0.12, 0.16, 0.06, 12]} />
                <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Stem */}
            <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.025, 0.04, 0.55, 8]} />
                <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Decorative knob */}
            <mesh position={[0, 0.05, 0]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Candle holder cup */}
            <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.04, 0.03, 0.04, 8]} />
                <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Candle */}
            <mesh position={[0, 0.28, 0]}>
                <cylinderGeometry args={[0.02, 0.025, 0.28, 8]} />
                <meshStandardMaterial color={c.cream} roughness={0.95} />
            </mesh>
            {/* Flame */}
            <mesh ref={flameRef} position={[0, 0.44, 0]}>
                <coneGeometry args={[0.015, 0.05, 8]} />
                <meshBasicMaterial color="#ff8800" />
            </mesh>
            {/* Flame glow */}
            <mesh position={[0, 0.43, 0]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshBasicMaterial color="#ff6600" transparent opacity={0.3} />
            </mesh>
            {/* Point light */}
            <pointLight
                ref={lightRef}
                position={[0, 0.5, 0]}
                color="#ff9944"
                intensity={5}
                distance={6}
                decay={1.5}
            />
        </group>
    )

    return (
        <group position={[0, 0, 0]}>

            {/* ===== FLOOR — Individual planks ===== */}
            {Array.from({ length: 8 }).map((_, i) => (
                <mesh key={`plank-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-4.2 + i * 1.2, -0.5, 0]} receiveShadow>
                    <planeGeometry args={[1.15, 12]} />
                    <meshStandardMaterial
                        color={i % 2 === 0 ? c.floorDark : c.floorLight}
                        roughness={0.85}
                        metalness={0.05}
                    />
                </mesh>
            ))}
            {/* Plank gap lines */}
            {Array.from({ length: 7 }).map((_, i) => (
                <mesh key={`gap-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-3.6 + i * 1.2, -0.49, 0]}>
                    <planeGeometry args={[0.015, 12]} />
                    <meshStandardMaterial color="#1a0e08" />
                </mesh>
            ))}

            {/* ===== PERSIAN RUG ===== */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
                <planeGeometry args={[3.2, 4.5]} />
                <meshStandardMaterial color={c.rugMain} roughness={0.95} />
            </mesh>
            {/* Rug outer border */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.475, 0]}>
                <planeGeometry args={[2.8, 4.0]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>
            {/* Rug inner field */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]}>
                <planeGeometry args={[2.4, 3.5]} />
                <meshStandardMaterial color={c.rugInner} roughness={0.95} />
            </mesh>
            {/* Rug center medallion */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.465, 0]}>
                <circleGeometry args={[0.5, 24]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>

            {/* ===== WALLS ===== */}
            {/* Back wall */}
            <mesh position={[0, 1.75, -4]} receiveShadow>
                <planeGeometry args={[12, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>
            {/* Wallpaper stripes */}
            {[-5, -3.5, -2, -0.5, 1, 2.5, 4, 5.5].map((x, i) => (
                <mesh key={`ws-${i}`} position={[x, 1.75, -3.98]}>
                    <planeGeometry args={[0.08, 5.5]} />
                    <meshStandardMaterial color={c.wallAccent} />
                </mesh>
            ))}
            {/* Left wall */}
            <mesh position={[-5, 1.75, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>
            {/* Right wall */}
            <mesh position={[5, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>

            {/* ===== CEILING ===== */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
                <planeGeometry args={[12, 12]} />
                <meshStandardMaterial color="#2a1a10" roughness={0.9} />
            </mesh>
            {/* Ceiling beams */}
            {[-2, 2].map((x, i) => (
                <mesh key={`beam-${i}`} position={[x, 3.9, 0]}>
                    <boxGeometry args={[0.2, 0.15, 12]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.8} />
                </mesh>
            ))}
            {/* Crown molding — back wall */}
            <mesh position={[0, 3.95, -3.95]}>
                <boxGeometry args={[12, 0.12, 0.12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>
            {/* Crown molding — left */}
            <mesh position={[-4.95, 3.95, 0]}>
                <boxGeometry args={[0.12, 0.12, 12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>
            {/* Crown molding — right */}
            <mesh position={[4.95, 3.95, 0]}>
                <boxGeometry args={[0.12, 0.12, 12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>

            {/* ===== WAINSCOTING ===== */}
            <mesh position={[0, 0.25, -3.95]}>
                <boxGeometry args={[12, 1.5, 0.1]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.7} />
            </mesh>
            {/* Chair rail molding */}
            <mesh position={[0, 1.05, -3.93]}>
                <boxGeometry args={[12, 0.06, 0.06]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.5} />
            </mesh>
            {/* Wainscoting panel dividers */}
            {[-4.5, -3, -1.5, 0, 1.5, 3, 4.5].map((x, i) => (
                <mesh key={`wd-${i}`} position={[x, 0.25, -3.88]}>
                    <boxGeometry args={[0.06, 1.4, 0.04]} />
                    <meshStandardMaterial color={c.lightWood} roughness={0.6} />
                </mesh>
            ))}

            {/* ===== TALL BOOKSHELF — Left ===== */}
            <group position={[-3.5, -0.5, -3.5]}>
                <mesh position={[0, 2, 0]}>
                    <boxGeometry args={[2.2, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.65} />
                </mesh>
                {/* Shelves */}
                {[0.1, 0.7, 1.3, 1.9, 2.5, 3.1].map((y, i) => (
                    <mesh key={`ls-${i}`} position={[0, y, 0.05]}>
                        <boxGeometry args={[2.0, 0.04, 0.5]} />
                        <meshStandardMaterial color={c.medWood} roughness={0.6} />
                    </mesh>
                ))}
                {/* Books on each shelf */}
                {[0.15, 0.75, 1.35, 1.95, 2.55, 3.15].map((y, row) => (
                    <BookRow key={`lb-${row}`} y={y} count={8} />
                ))}
                {/* Decorative crown */}
                <mesh position={[0, 4.05, 0]}>
                    <boxGeometry args={[2.4, 0.12, 0.6]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* End caps */}
                <mesh position={[-1.05, 2, 0]}>
                    <boxGeometry args={[0.08, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[1.05, 2, 0]}>
                    <boxGeometry args={[0.08, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
            </group>

            {/* ===== TALL BOOKSHELF — Right ===== */}
            <group position={[3.5, -0.5, -3.5]}>
                <mesh position={[0, 2, 0]}>
                    <boxGeometry args={[2.2, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.65} />
                </mesh>
                {[0.1, 0.7, 1.3, 1.9, 2.5, 3.1].map((y, i) => (
                    <mesh key={`rs-${i}`} position={[0, y, 0.05]}>
                        <boxGeometry args={[2.0, 0.04, 0.5]} />
                        <meshStandardMaterial color={c.medWood} roughness={0.6} />
                    </mesh>
                ))}
                {[0.15, 0.75, 1.35, 1.95, 2.55, 3.15].map((y, row) => (
                    <BookRow key={`rb-${row}`} y={y} count={8} />
                ))}
                <mesh position={[0, 4.05, 0]}>
                    <boxGeometry args={[2.4, 0.12, 0.6]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[-1.05, 2, 0]}>
                    <boxGeometry args={[0.08, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[1.05, 2, 0]}>
                    <boxGeometry args={[0.08, 4, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
            </group>

            {/* ===== NARROW BOOKSHELVES flanking the window ===== */}
            {[-1.8, 1.8].map((x, si) => (
                <group key={`wbs-${si}`} position={[x, -0.5, -3.7]}>
                    <mesh position={[0, 1.5, 0]}>
                        <boxGeometry args={[0.9, 3, 0.4]} />
                        <meshStandardMaterial color={c.darkWood} roughness={0.65} />
                    </mesh>
                    {[0.1, 0.7, 1.3, 1.9, 2.5].map((y, i) => (
                        <mesh key={i} position={[0, y, 0.03]}>
                            <boxGeometry args={[0.8, 0.04, 0.36]} />
                            <meshStandardMaterial color={c.medWood} roughness={0.6} />
                        </mesh>
                    ))}
                    {[0.15, 0.75, 1.35, 1.95, 2.55].map((y, row) => (
                        <group key={row} position={[0, y, 0.06]}>
                            {[-0.25, 0, 0.25].map((bx, i) => (
                                <mesh key={i} position={[bx, 0.14, 0]}>
                                    <boxGeometry args={[0.1 + Math.sin(i * 5) * 0.02, 0.26 + Math.sin(row * 3 + i) * 0.06, 0.18]} />
                                    <meshStandardMaterial color={bookColors[(row * 3 + i + si * 5) % bookColors.length]} roughness={0.85} />
                                </mesh>
                            ))}
                        </group>
                    ))}
                </group>
            ))}

            {/* ===== ROLLING LIBRARY LADDER ===== */}
            <group position={[-3.8, -0.5, -3.0]} rotation={[0.12, 0.15, 0]}>
                {/* Rails */}
                <mesh position={[-0.15, 1.5, 0]}>
                    <boxGeometry args={[0.04, 3.2, 0.04]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.15, 1.5, 0]}>
                    <boxGeometry args={[0.04, 3.2, 0.04]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.6} />
                </mesh>
                {/* Rungs */}
                {[0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7].map((y, i) => (
                    <mesh key={i} position={[0, y, 0]}>
                        <boxGeometry args={[0.28, 0.03, 0.04]} />
                        <meshStandardMaterial color={c.lightWood} roughness={0.6} />
                    </mesh>
                ))}
            </group>

            {/* ===== WINDOW ===== */}
            <group position={[0, 2, -3.9]}>
                <mesh>
                    <boxGeometry args={[1.8, 2.4, 0.12]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Glass — moonlit night */}
                <mesh position={[0, 0, 0.07]}>
                    <planeGeometry args={[1.5, 2.0]} />
                    <meshStandardMaterial
                        color="#0a0a18"
                        emissive="#0a0a1a"
                        emissiveIntensity={0.15}
                        transparent
                        opacity={0.85}
                    />
                </mesh>
                {/* Cross bars */}
                <mesh position={[0, 0, 0.08]}>
                    <boxGeometry args={[1.5, 0.04, 0.02]} />
                    <meshStandardMaterial color={c.darkWood} />
                </mesh>
                <mesh position={[0, 0, 0.08]}>
                    <boxGeometry args={[0.04, 2.0, 0.02]} />
                    <meshStandardMaterial color={c.darkWood} />
                </mesh>
                {/* Curtains */}
                <mesh position={[-1.15, 0, 0.1]}>
                    <boxGeometry args={[0.5, 2.8, 0.06]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.92} />
                </mesh>
                <mesh position={[1.15, 0, 0.1]}>
                    <boxGeometry args={[0.5, 2.8, 0.06]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.92} />
                </mesh>
                {/* Curtain folds (subtle depth) */}
                {[-1.3, -1.1, -1.0].map((x, i) => (
                    <mesh key={`cl-${i}`} position={[x, 0, 0.14]}>
                        <boxGeometry args={[0.05, 2.7, 0.02]} />
                        <meshStandardMaterial color="#5a1010" roughness={0.9} />
                    </mesh>
                ))}
                {[1.0, 1.1, 1.3].map((x, i) => (
                    <mesh key={`cr-${i}`} position={[x, 0, 0.14]}>
                        <boxGeometry args={[0.05, 2.7, 0.02]} />
                        <meshStandardMaterial color="#5a1010" roughness={0.9} />
                    </mesh>
                ))}
                {/* Curtain rod */}
                <mesh position={[0, 1.5, 0.15]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.025, 0.025, 3.0, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Rod finials */}
                <mesh position={[-1.5, 1.5, 0.15]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[1.5, 1.5, 0.15]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
            </group>

            {/* ===== VICTORIAN ARMCHAIR — Fitted to avatar ===== */}
            {/* Avatar group: [0, 0.9, -2], primitive: [0, -1.3, 1] scale 1.5 */}
            <group position={[0, -0.5, -1.2]} scale={[1.15, 1.05, 1.1]}>
                {/* Chair seat */}
                <mesh position={[0, 0.35, 0]} castShadow>
                    <boxGeometry args={[0.7, 0.1, 0.6]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.85} />
                </mesh>
                {/* Seat cushion */}
                <mesh position={[0, 0.42, 0.02]}>
                    <boxGeometry args={[0.6, 0.06, 0.52]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.92} />
                </mesh>

                {/* Chair back */}
                <mesh position={[0, 0.85, -0.28]} castShadow>
                    <boxGeometry args={[0.7, 0.9, 0.08]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.85} />
                </mesh>
                {/* Back cushion */}
                <mesh position={[0, 0.82, -0.2]}>
                    <boxGeometry args={[0.55, 0.7, 0.08]} />
                    <meshStandardMaterial color={c.burgundy} roughness={0.92} />
                </mesh>
                {/* Tufted buttons on back */}
                {[[-0.12, 0.7], [0.12, 0.7], [-0.12, 0.95], [0.12, 0.95], [0, 0.82]].map(([x, y], i) => (
                    <mesh key={`btn-${i}`} position={[x, y, -0.14]}>
                        <sphereGeometry args={[0.02, 6, 6]} />
                        <meshStandardMaterial color={c.leather} roughness={0.8} />
                    </mesh>
                ))}

                {/* Chair back top (wood crown) */}
                <mesh position={[0, 1.35, -0.28]}>
                    <boxGeometry args={[0.78, 0.1, 0.1]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>

                {/* Armrests */}
                <mesh position={[-0.4, 0.55, -0.05]}>
                    <boxGeometry args={[0.08, 0.3, 0.5]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.4, 0.55, -0.05]}>
                    <boxGeometry args={[0.08, 0.3, 0.5]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Armrest tops */}
                <mesh position={[-0.4, 0.72, -0.05]}>
                    <boxGeometry args={[0.12, 0.04, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.4, 0.72, -0.05]}>
                    <boxGeometry args={[0.12, 0.04, 0.55]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Armrest front caps */}
                <mesh position={[-0.4, 0.72, 0.22]}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.4, 0.72, 0.22]}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>

                {/* Chair legs */}
                {[[-0.3, -0.25], [-0.3, 0.25], [0.3, -0.25], [0.3, 0.25]].map(([x, z], i) => (
                    <group key={`leg-${i}`}>
                        <mesh position={[x, 0.15, z]}>
                            <boxGeometry args={[0.06, 0.35, 0.06]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                        {/* Leg foot */}
                        <mesh position={[x, 0.0, z]}>
                            <sphereGeometry args={[0.035, 6, 6]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                    </group>
                ))}
            </group>

            {/* ===== READING TABLE ===== */}
            <group position={[0, -0.5, 0.6]}>
                {/* Table top */}
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.0, 0.07, 1.0]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.5} metalness={0.05} />
                </mesh>
                {/* Table edge trim */}
                <mesh position={[0, 0.72, 0]}>
                    <boxGeometry args={[2.05, 0.035, 1.05]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>

                {/* Table legs */}
                {[[-0.85, -0.4], [-0.85, 0.4], [0.85, -0.4], [0.85, 0.4]].map(([x, z], i) => (
                    <group key={`tl-${i}`} position={[x, 0, z]}>
                        <mesh position={[0, 0.35, 0]}>
                            <cylinderGeometry args={[0.035, 0.045, 0.7, 8]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                        <mesh position={[0, 0.35, 0]}>
                            <sphereGeometry args={[0.05, 8, 8]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                        <mesh position={[0, 0.02, 0]}>
                            <sphereGeometry args={[0.04, 8, 8]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                    </group>
                ))}
                {/* Cross bars */}
                <mesh position={[0, 0.2, -0.4]}>
                    <boxGeometry args={[1.7, 0.035, 0.035]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.2, 0.4]}>
                    <boxGeometry args={[1.7, 0.035, 0.035]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>

                {/* ===== OPEN BOOK ===== */}
                <group position={[0, 0.8, -0.05]} rotation={[-0.15, 0, 0]}>
                    <mesh position={[-0.18, 0.01, 0]} rotation={[0, 0, 0.03]}>
                        <boxGeometry args={[0.35, 0.02, 0.45]} />
                        <meshStandardMaterial color="#f0ead8" roughness={0.95} />
                    </mesh>
                    <mesh position={[0.18, 0.01, 0]} rotation={[0, 0, -0.03]}>
                        <boxGeometry args={[0.35, 0.02, 0.45]} />
                        <meshStandardMaterial color="#f0ead8" roughness={0.95} />
                    </mesh>
                    <mesh position={[0, 0.005, 0]}>
                        <boxGeometry args={[0.03, 0.025, 0.46]} />
                        <meshStandardMaterial color={c.leather} roughness={0.7} />
                    </mesh>
                    {/* Covers */}
                    <mesh position={[-0.19, -0.005, 0]} rotation={[0, 0, 0.05]}>
                        <boxGeometry args={[0.36, 0.015, 0.47]} />
                        <meshStandardMaterial color="#6a0a0a" roughness={0.7} />
                    </mesh>
                    <mesh position={[0.19, -0.005, 0]} rotation={[0, 0, -0.05]}>
                        <boxGeometry args={[0.36, 0.015, 0.47]} />
                        <meshStandardMaterial color="#6a0a0a" roughness={0.7} />
                    </mesh>
                    {/* Text lines */}
                    {[-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map((z, i) => (
                        <mesh key={`tl-${i}`} position={[-0.18, 0.022, z]}>
                            <boxGeometry args={[0.28, 0.001, 0.006]} />
                            <meshStandardMaterial color="#3a3a3a" opacity={0.25} transparent />
                        </mesh>
                    ))}
                    {[-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map((z, i) => (
                        <mesh key={`tr-${i}`} position={[0.18, 0.022, z]}>
                            <boxGeometry args={[0.28, 0.001, 0.006]} />
                            <meshStandardMaterial color="#3a3a3a" opacity={0.25} transparent />
                        </mesh>
                    ))}
                    {/* Page stack */}
                    <mesh position={[-0.18, -0.015, 0]}>
                        <boxGeometry args={[0.34, 0.018, 0.44]} />
                        <meshStandardMaterial color="#e0d8c4" roughness={0.9} />
                    </mesh>
                    <mesh position={[0.18, -0.015, 0]}>
                        <boxGeometry args={[0.34, 0.018, 0.44]} />
                        <meshStandardMaterial color="#e0d8c4" roughness={0.9} />
                    </mesh>
                </group>

                {/* Quill pen holder */}
                <mesh position={[0.7, 0.85, -0.2]}>
                    <cylinderGeometry args={[0.035, 0.04, 0.1, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                {/* Quill pen */}
                <mesh position={[0.7, 0.93, -0.2]} rotation={[0.3, 0, 0.1]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.22, 4]} />
                    <meshStandardMaterial color="#f5f5f0" />
                </mesh>
                {/* Ink bottle */}
                <mesh position={[0.55, 0.82, -0.25]}>
                    <cylinderGeometry args={[0.025, 0.025, 0.07, 8]} />
                    <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.2} />
                </mesh>

                {/* ===== Mathematical papers (scattered) ===== */}
                <mesh position={[0.35, 0.79, 0.15]} rotation={[-Math.PI / 2 + 0.02, 0, 0.15]}>
                    <planeGeometry args={[0.22, 0.3]} />
                    <meshStandardMaterial color="#ebe4d0" roughness={0.95} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0.5, 0.79, 0.25]} rotation={[-Math.PI / 2 + 0.01, 0, -0.1]}>
                    <planeGeometry args={[0.18, 0.26]} />
                    <meshStandardMaterial color="#e8e0cc" roughness={0.95} side={THREE.DoubleSide} />
                </mesh>

                {/* ===== Tea cup & saucer ===== */}
                <group position={[-0.65, 0.79, 0.15]}>
                    {/* Saucer */}
                    <mesh position={[0, 0.005, 0]}>
                        <cylinderGeometry args={[0.06, 0.065, 0.01, 12]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                    {/* Cup */}
                    <mesh position={[0, 0.04, 0]}>
                        <cylinderGeometry args={[0.035, 0.03, 0.06, 10]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                    {/* Handle */}
                    <mesh position={[0.045, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <torusGeometry args={[0.02, 0.005, 6, 8, Math.PI]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                </group>

                {/* Book stack on table */}
                <group position={[-0.7, 0.8, -0.15]}>
                    <mesh position={[0, 0.02, 0]}>
                        <boxGeometry args={[0.22, 0.035, 0.3]} />
                        <meshStandardMaterial color="#0a3a1a" roughness={0.8} />
                    </mesh>
                    <mesh position={[0.01, 0.055, -0.01]} rotation={[0, 0.08, 0]}>
                        <boxGeometry args={[0.2, 0.035, 0.27]} />
                        <meshStandardMaterial color="#3a0a2a" roughness={0.8} />
                    </mesh>
                    <mesh position={[-0.01, 0.09, 0.005]} rotation={[0, -0.05, 0]}>
                        <boxGeometry args={[0.21, 0.035, 0.28]} />
                        <meshStandardMaterial color="#0a1a3a" roughness={0.8} />
                    </mesh>
                </group>

                {/* Magnifying glass */}
                <group position={[0.3, 0.8, 0.3]} rotation={[0, 0.3, 0]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
                        <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0, -0.08]}>
                        <torusGeometry args={[0.035, 0.004, 8, 16]} />
                        <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                    </mesh>
                </group>
            </group>

            {/* ===== CANDELABRAS ===== */}
            <Candelabra position={[-1.8, 0, -2]} lightRef={candleLight1Ref} flameRef={candleFlame1Ref} />
            <Candelabra position={[1.8, 0, -2]} lightRef={candleLight2Ref} flameRef={candleFlame2Ref} />
            <Candelabra position={[0, 0.25, 0.15]} lightRef={candleLight3Ref} flameRef={candleFlame3Ref} />

            {/* ===== GRANDFATHER CLOCK ===== */}
            <group position={[-4.5, -0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <mesh position={[0, 1.2, 0]}>
                    <boxGeometry args={[0.5, 2.8, 0.4]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Crown */}
                <mesh position={[0, 2.65, 0]}>
                    <boxGeometry args={[0.6, 0.12, 0.45]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Clock face */}
                <mesh position={[0, 2.0, 0.21]}>
                    <circleGeometry args={[0.18, 32]} />
                    <meshStandardMaterial color={c.cream} />
                </mesh>
                <mesh position={[0, 2.0, 0.22]}>
                    <ringGeometry args={[0.17, 0.2, 32]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Clock hands */}
                <mesh position={[0, 2.0, 0.23]} rotation={[0, 0, Math.PI / 4]}>
                    <boxGeometry args={[0.01, 0.12, 0.01]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
                <mesh position={[0, 2.0, 0.23]} rotation={[0, 0, Math.PI / 1.5]}>
                    <boxGeometry args={[0.01, 0.08, 0.01]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
                {/* Pendulum window */}
                <mesh position={[0, 0.8, 0.21]}>
                    <planeGeometry args={[0.25, 0.6]} />
                    <meshStandardMaterial color="#0a0a18" transparent opacity={0.5} />
                </mesh>
                {/* Pendulum */}
                <group ref={pendulumRef} position={[0, 1.1, 0.22]}>
                    <mesh position={[0, -0.25, 0]}>
                        <boxGeometry args={[0.005, 0.4, 0.005]} />
                        <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                    </mesh>
                    <mesh position={[0, -0.45, 0]}>
                        <circleGeometry args={[0.06, 16]} />
                        <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                    </mesh>
                </group>
            </group>

            {/* ===== GLOBE ===== */}
            <group position={[3.8, -0.5, -1.5]}>
                <mesh position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.025, 0.07, 1, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0, 1.05, 0]}>
                    <sphereGeometry args={[0.18, 20, 20]} />
                    <meshStandardMaterial color="#3a5a38" roughness={0.65} />
                </mesh>
                <mesh position={[0, 1.05, 0]} rotation={[0.3, 0, 0]}>
                    <torusGeometry args={[0.2, 0.006, 8, 32]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
            </group>

            {/* ===== ANALYTICAL ENGINE DIAGRAM (framed) ===== */}
            <group position={[1.8, 2.6, -3.85]}>
                {/* Frame */}
                <mesh>
                    <boxGeometry args={[0.9, 0.7, 0.04]} />
                    <meshStandardMaterial color={c.gold} metalness={0.5} roughness={0.5} />
                </mesh>
                {/* Background */}
                <mesh position={[0, 0, 0.025]}>
                    <planeGeometry args={[0.75, 0.55]} />
                    <meshStandardMaterial color="#f0e8d0" roughness={0.95} />
                </mesh>
                {/* Gear diagrams */}
                <mesh position={[-0.15, 0.05, 0.03]}>
                    <torusGeometry args={[0.08, 0.008, 8, 16]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
                <mesh position={[0.12, -0.05, 0.03]}>
                    <torusGeometry args={[0.06, 0.006, 8, 12]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
                <mesh position={[0.12, 0.12, 0.03]}>
                    <torusGeometry args={[0.04, 0.005, 8, 10]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
                {/* Connecting lines */}
                <mesh position={[0, 0, 0.03]} rotation={[0, 0, 0.5]}>
                    <boxGeometry args={[0.3, 0.004, 0.001]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
                <mesh position={[0.05, 0.05, 0.03]} rotation={[0, 0, -0.3]}>
                    <boxGeometry args={[0.2, 0.004, 0.001]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
            </group>

            {/* ===== PORTRAIT FRAME (Ada) ===== */}
            <group position={[-1.8, 2.6, -3.85]}>
                <mesh>
                    <boxGeometry args={[0.7, 0.9, 0.05]} />
                    <meshStandardMaterial color={c.gold} metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.03]}>
                    <planeGeometry args={[0.55, 0.75]} />
                    <meshStandardMaterial color="#1a1a18" />
                </mesh>
            </group>

            {/* ===== DUST MOTES near window ===== */}
            {[dust1Ref, dust2Ref, dust3Ref, dust4Ref].map((ref, i) => (
                <mesh key={`dust-${i}`} ref={ref} position={[-0.3 + i * 0.3, 2.2, -3.2]}>
                    <sphereGeometry args={[0.008, 4, 4]} />
                    <meshBasicMaterial color="#ffeecc" transparent opacity={0.4} />
                </mesh>
            ))}

            {/* ===== LIGHTING — Atmospheric & Realistic ===== */}
            {/* Soft ambient — low to let candles dominate */}
            <ambientLight intensity={0.25} color="#fff5e6" />

            {/* Main key light — warm, from above-right */}
            <directionalLight
                position={[2, 4, 3]}
                intensity={0.9}
                color="#ffeedd"
                castShadow
            />

            {/* Window moonlight — cool accent from behind */}
            <directionalLight
                position={[0, 3, -5]}
                intensity={0.25}
                color="#8899bb"
            />

            {/* Subtle fill from camera direction */}
            <pointLight
                position={[0, 3, 2]}
                intensity={0.3}
                color="#fff8f0"
                distance={10}
            />
        </group>
    )
}
