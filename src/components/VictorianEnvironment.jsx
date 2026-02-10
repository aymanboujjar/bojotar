import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Old Library — bright candlelit atmosphere
export default function VictorianEnvironment() {
    // Candle light refs (many candles for bright illumination)
    const candleLightRefs = useRef([])
    const candleFlameRefs = useRef([])
    const pendulumRef = useRef()
    const dustRefs = useRef([])
    const smokeRefs = useRef([])

    // Animate candle flames, dust motes
    useFrame((state) => {
        const time = state.clock.elapsedTime

        // Flickering candle lights — each with unique rhythm
        candleLightRefs.current.forEach((ref, i) => {
            if (ref) {
                const base = 8 + (i % 3) * 1.5
                ref.intensity = base + Math.sin(time * (7 + i * 1.3)) * 1.2 + Math.sin(time * (11 + i * 0.7)) * 0.8
            }
        })

        // Flame sway
        candleFlameRefs.current.forEach((ref, i) => {
            if (ref) {
                ref.scale.y = 1 + Math.sin(time * (10 + i * 1.5)) * 0.15
                ref.rotation.z = Math.sin(time * (6 + i * 0.8)) * 0.12
            }
        })

        // Pendulum swing
        if (pendulumRef.current) {
            pendulumRef.current.rotation.z = Math.sin(time * 1.5) * 0.2
        }

        // Dust motes drifting throughout room
        dustRefs.current.forEach((ref, i) => {
            if (ref) {
                const offset = i * 2.1
                ref.position.x = -3 + Math.sin(time * 0.08 + offset) * 6
                ref.position.y = 1.5 + Math.sin(time * 0.12 + offset) * 1.5
                ref.position.z = -2 + Math.cos(time * 0.06 + offset) * 3
                if (ref.material) {
                    ref.material.opacity = 0.2 + Math.sin(time * 0.3 + offset) * 0.12
                }
            }
        })

        // Smoke particles drifting up from candles
        smokeRefs.current.forEach((ref, i) => {
            if (ref) {
                const offset = i * 2.3
                const cycle = (time * 0.4 + offset) % 3.0
                const progress = cycle / 3.0
                ref.position.y = progress * 1.2
                ref.position.x = Math.sin(time * 1.5 + offset) * 0.08
                ref.position.z = Math.cos(time * 1.2 + offset) * 0.06
                const scale = 1 + progress * 2
                ref.scale.set(scale, scale, scale)
                if (ref.material) {
                    ref.material.opacity = (1 - progress) * 0.1
                }
            }
        })
    })

    // Warm library color palette
    const c = {
        darkWood: '#3d2517',
        medWood: '#6b4226',
        lightWood: '#8b6340',
        floorDark: '#5a3a24',
        floorLight: '#6d4830',
        wall: '#4a3020',
        wallAccent: '#5a3a28',
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
        '#6a2010', '#0a4a2a', '#4a3a1a', '#2a0a3a', '#5a4a0a',
    ]

    // Helper: render a row of books on a shelf
    const BookRow = ({ y, xOffset = 0, count = 7 }) => (
        <group position={[xOffset, y, 0.28]}>
            {Array.from({ length: count }).map((_, i) => {
                const w = 0.08 + Math.sin(i * 7.3) * 0.04
                const h = 0.28 + Math.sin(i * 3.7) * 0.08
                const x = -0.7 + i * (1.4 / count)
                return (
                    <mesh key={i} position={[x, h / 2 + 0.02, 0]}>
                        <boxGeometry args={[w, h, 0.18]} />
                        <meshStandardMaterial
                            color={bookColors[i % bookColors.length]}
                            roughness={0.85}
                        />
                    </mesh>
                )
            })}
        </group>
    )

    // Helper: single candelabra with flame and light
    let candleIndex = 0
    const Candelabra = ({ position, tall = false }) => {
        const idx = candleIndex++
        const stemHeight = tall ? 0.8 : 0.55
        const candleY = tall ? 0.2 : 0.12
        const candleH = tall ? 0.35 : 0.28
        const flameY = tall ? 0.58 : 0.44
        const lightY = tall ? 0.65 : 0.5
        return (
            <group position={position}>
                {/* Base */}
                <mesh position={[0, -0.45, 0]}>
                    <cylinderGeometry args={[0.12, 0.16, 0.06, 12]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Stem */}
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.025, 0.04, stemHeight, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Decorative knob */}
                <mesh position={[0, 0.05, 0]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Candle holder cup */}
                <mesh position={[0, candleY, 0]}>
                    <cylinderGeometry args={[0.04, 0.03, 0.04, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                {/* Candle */}
                <mesh position={[0, candleY + 0.16, 0]}>
                    <cylinderGeometry args={[0.02, 0.025, candleH, 8]} />
                    <meshStandardMaterial color={c.cream} roughness={0.95} />
                </mesh>
                {/* Flame */}
                <mesh ref={el => { candleFlameRefs.current[idx] = el }} position={[0, flameY, 0]}>
                    <coneGeometry args={[0.018, 0.06, 8]} />
                    <meshBasicMaterial color="#ffaa22" />
                </mesh>
                {/* Flame glow sphere */}
                <mesh position={[0, flameY - 0.01, 0]}>
                    <sphereGeometry args={[0.035, 8, 8]} />
                    <meshBasicMaterial color="#ff8800" transparent opacity={0.35} />
                </mesh>
                {/* Point light — bright for clear illumination */}
                <pointLight
                    ref={el => { candleLightRefs.current[idx] = el }}
                    position={[0, lightY, 0]}
                    color="#ffcc77"
                    intensity={8}
                    distance={8}
                    decay={1.2}
                />
            </group>
        )
    }

    // Wall sconce candle (mounted on wall)
    const WallSconce = ({ position, rotation = [0, 0, 0] }) => {
        const idx = candleIndex++
        return (
            <group position={position} rotation={rotation}>
                {/* Wall plate */}
                <mesh position={[0, 0, -0.02]}>
                    <boxGeometry args={[0.15, 0.2, 0.04]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Arm */}
                <mesh position={[0, 0, 0.08]}>
                    <boxGeometry args={[0.03, 0.03, 0.16]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                {/* Cup */}
                <mesh position={[0, 0.02, 0.16]}>
                    <cylinderGeometry args={[0.035, 0.025, 0.04, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                {/* Candle */}
                <mesh position={[0, 0.18, 0.16]}>
                    <cylinderGeometry args={[0.015, 0.02, 0.24, 8]} />
                    <meshStandardMaterial color={c.cream} roughness={0.95} />
                </mesh>
                {/* Flame */}
                <mesh ref={el => { candleFlameRefs.current[idx] = el }} position={[0, 0.32, 0.16]}>
                    <coneGeometry args={[0.014, 0.05, 8]} />
                    <meshBasicMaterial color="#ffaa22" />
                </mesh>
                {/* Glow */}
                <mesh position={[0, 0.31, 0.16]}>
                    <sphereGeometry args={[0.028, 8, 8]} />
                    <meshBasicMaterial color="#ff8800" transparent opacity={0.3} />
                </mesh>
                {/* Light */}
                <pointLight
                    ref={el => { candleLightRefs.current[idx] = el }}
                    position={[0, 0.4, 0.2]}
                    color="#ffcc77"
                    intensity={6}
                    distance={7}
                    decay={1.3}
                />
            </group>
        )
    }

    // Helper: Book Pile on floor/table
    const BookPile = ({ position, rotation = [0, 0, 0], count = 3 }) => (
        <group position={position} rotation={rotation}>
            {Array.from({ length: count }).map((_, i) => (
                <mesh key={i} position={[0, 0.02 + i * 0.045, 0]} rotation={[0, Math.sin(i * 1.5) * 0.2, 0]} castShadow>
                    <boxGeometry args={[0.22, 0.04, 0.3]} />
                    <meshStandardMaterial color={bookColors[(i + Math.floor(position[0] * 10)) % bookColors.length]} roughness={0.8} />
                </mesh>
            ))}
        </group>
    )

    // Helper: Scroll
    const Scroll = ({ position, rotation = [0, 0, 0] }) => (
        <group position={position} rotation={rotation}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                <meshStandardMaterial color="#f5f0e0" roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.022, 0.022, 0.03, 8]} />
                <meshStandardMaterial color="#7a1a1a" roughness={0.8} />
            </mesh>
        </group>
    )

    // Tall bookshelf component (reusable)
    const TallBookshelf = ({ position, rotation = [0, 0, 0], width = 2.2, shelves = 6, booksPerShelf = 8 }) => (
        <group position={position} rotation={rotation}>
            {/* Back panel */}
            <mesh position={[0, 2, 0]}>
                <boxGeometry args={[width, 4, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.65} />
            </mesh>
            {/* Shelves */}
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.1 + i * (3.2 / shelves)
                return (
                    <mesh key={`shelf-${i}`} position={[0, y, 0.05]}>
                        <boxGeometry args={[width - 0.2, 0.04, 0.5]} />
                        <meshStandardMaterial color={c.medWood} roughness={0.6} />
                    </mesh>
                )
            })}
            {/* Books on each shelf */}
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.15 + i * (3.2 / shelves)
                return <BookRow key={`books-${i}`} y={y} count={booksPerShelf} />
            })}
            {/* Decorative crown */}
            <mesh position={[0, 4.05, 0]}>
                <boxGeometry args={[width + 0.2, 0.12, 0.6]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.6} />
            </mesh>
            {/* Side panels */}
            <mesh position={[-(width / 2 + 0.02), 2, 0]}>
                <boxGeometry args={[0.08, 4, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.6} />
            </mesh>
            <mesh position={[(width / 2 + 0.02), 2, 0]}>
                <boxGeometry args={[0.08, 4, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.6} />
            </mesh>
        </group>
    )

    // Reset candle index for render
    candleIndex = 0

    return (
        <group position={[0, 0, 0]}>

            {/* ===== FLOOR — Wood planks ===== */}
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
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.475, 0]}>
                <planeGeometry args={[2.8, 4.0]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]}>
                <planeGeometry args={[2.4, 3.5]} />
                <meshStandardMaterial color={c.rugInner} roughness={0.95} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.465, 0]}>
                <circleGeometry args={[0.5, 24]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>

            {/* ===== WALLS — warm brown tones for library feel ===== */}
            {/* Back wall */}
            <mesh position={[0, 1.75, -4]} receiveShadow>
                <planeGeometry args={[12, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>
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
                <meshStandardMaterial color="#3a2a18" roughness={0.9} />
            </mesh>
            {/* Ceiling beams */}
            {[-2, 0, 2].map((x, i) => (
                <mesh key={`beam-${i}`} position={[x, 3.9, 0]}>
                    <boxGeometry args={[0.2, 0.15, 12]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.8} />
                </mesh>
            ))}
            {/* Crown molding */}
            <mesh position={[0, 3.95, -3.95]}>
                <boxGeometry args={[12, 0.12, 0.12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>
            <mesh position={[-4.95, 3.95, 0]}>
                <boxGeometry args={[0.12, 0.12, 12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>
            <mesh position={[4.95, 3.95, 0]}>
                <boxGeometry args={[0.12, 0.12, 12]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.6} />
            </mesh>

            {/* ===== WAINSCOTING — lower wall panels ===== */}
            <mesh position={[0, 0.25, -3.95]}>
                <boxGeometry args={[12, 1.5, 0.1]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.05, -3.93]}>
                <boxGeometry args={[12, 0.06, 0.06]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.5} />
            </mesh>
            {[-4.5, -3, -1.5, 0, 1.5, 3, 4.5].map((x, i) => (
                <mesh key={`wd-${i}`} position={[x, 0.25, -3.88]}>
                    <boxGeometry args={[0.06, 1.4, 0.04]} />
                    <meshStandardMaterial color={c.lightWood} roughness={0.6} />
                </mesh>
            ))}

            {/* ===== TALL BOOKSHELVES — Multiple around the room ===== */}

            {/* Main bookshelf — LEFT of avatar (avatar stands to the right of this) */}
            <TallBookshelf position={[-2.2, -0.5, -3.5]} shelves={7} booksPerShelf={9} width={2.4} />

            {/* Bookshelf — RIGHT of avatar */}
            <TallBookshelf position={[2.2, -0.5, -3.5]} shelves={7} booksPerShelf={9} width={2.4} />

            {/* Far left bookshelf — along back wall */}
            <TallBookshelf position={[-4.2, -0.5, -3.5]} shelves={6} booksPerShelf={7} width={1.6} />

            {/* Far right bookshelf — along back wall */}
            <TallBookshelf position={[4.2, -0.5, -3.5]} shelves={6} booksPerShelf={7} width={1.6} />

            {/* Left wall bookshelves */}
            <group position={[-4.8, -0.5, -1.5]} rotation={[0, Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={6} booksPerShelf={8} width={2.0} />
            </group>
            <group position={[-4.8, -0.5, 1.5]} rotation={[0, Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={6} booksPerShelf={8} width={2.0} />
            </group>

            {/* Right wall bookshelves */}
            <group position={[4.8, -0.5, -1.5]} rotation={[0, -Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={6} booksPerShelf={8} width={2.0} />
            </group>
            <group position={[4.8, -0.5, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={6} booksPerShelf={8} width={2.0} />
            </group>

            {/* ===== READING TABLE (in front of avatar) ===== */}
            <group position={[0.5, -0.5, 0.2]}>
                {/* Table top */}
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.6, 0.07, 0.8]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.5} metalness={0.05} />
                </mesh>
                <mesh position={[0, 0.72, 0]}>
                    <boxGeometry args={[1.65, 0.035, 0.85]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {/* Table legs */}
                {[[-0.7, -0.35], [-0.7, 0.35], [0.7, -0.35], [0.7, 0.35]].map(([x, z], i) => (
                    <group key={`tl-${i}`} position={[x, 0, z]}>
                        <mesh position={[0, 0.35, 0]}>
                            <cylinderGeometry args={[0.035, 0.045, 0.7, 8]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                        <mesh position={[0, 0.02, 0]}>
                            <sphereGeometry args={[0.04, 8, 8]} />
                            <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                        </mesh>
                    </group>
                ))}

                {/* Open book on table */}
                <group position={[-0.2, 0.8, 0]} rotation={[-0.15, 0, 0]}>
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
                </group>

                {/* Book pile on table */}
                <BookPile position={[0.5, 0.79, 0.1]} rotation={[0, -0.2, 0]} count={4} />

                {/* Quill pen holder */}
                <mesh position={[0.55, 0.85, -0.2]}>
                    <cylinderGeometry args={[0.035, 0.04, 0.1, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0.55, 0.93, -0.2]} rotation={[0.3, 0, 0.1]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.22, 4]} />
                    <meshStandardMaterial color="#f5f5f0" />
                </mesh>

                {/* Ink bottle */}
                <mesh position={[0.4, 0.82, -0.25]}>
                    <cylinderGeometry args={[0.025, 0.025, 0.07, 8]} />
                    <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.2} />
                </mesh>

                {/* Tea cup & saucer */}
                <group position={[-0.55, 0.79, 0.25]}>
                    <mesh position={[0, 0.005, 0]}>
                        <cylinderGeometry args={[0.06, 0.065, 0.01, 12]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                    <mesh position={[0, 0.04, 0]}>
                        <cylinderGeometry args={[0.035, 0.03, 0.06, 10]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                    <mesh position={[0.045, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <torusGeometry args={[0.02, 0.005, 6, 8, Math.PI]} />
                        <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
                    </mesh>
                </group>

                {/* TABLE CANDELABRA — bright candle on the reading table */}
                <Candelabra position={[0.5, 0.79, -0.1]} tall />
            </group>

            {/* ===== MANY CANDELABRAS for bright illumination ===== */}

            {/* Floor candelabras near avatar */}
            <Candelabra position={[-1.0, -0.05, -2.0]} tall />
            <Candelabra position={[1.0, -0.05, -2.0]} tall />

            {/* Floor candelabras around the room */}
            <Candelabra position={[-3.5, -0.05, -2.5]} tall />
            <Candelabra position={[3.5, -0.05, -2.5]} tall />
            <Candelabra position={[-3.5, -0.05, 1.0]} tall />
            <Candelabra position={[3.5, -0.05, 1.0]} tall />
            <Candelabra position={[0, -0.05, 2.0]} />

            {/* ===== WALL SCONCE CANDLES — mounted on walls for even lighting ===== */}

            {/* Back wall sconces */}
            <WallSconce position={[-3.5, 2.5, -3.9]} />
            <WallSconce position={[-1.0, 2.5, -3.9]} />
            <WallSconce position={[1.0, 2.5, -3.9]} />
            <WallSconce position={[3.5, 2.5, -3.9]} />

            {/* Left wall sconces */}
            <WallSconce position={[-4.9, 2.5, -2.5]} rotation={[0, Math.PI / 2, 0]} />
            <WallSconce position={[-4.9, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} />
            <WallSconce position={[-4.9, 2.5, 2.5]} rotation={[0, Math.PI / 2, 0]} />

            {/* Right wall sconces */}
            <WallSconce position={[4.9, 2.5, -2.5]} rotation={[0, -Math.PI / 2, 0]} />
            <WallSconce position={[4.9, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} />
            <WallSconce position={[4.9, 2.5, 2.5]} rotation={[0, -Math.PI / 2, 0]} />

            {/* ===== ROLLING LIBRARY LADDER ===== */}
            <group position={[-3.0, -0.5, -3.0]} rotation={[0.12, 0.15, 0]}>
                <mesh position={[-0.15, 1.5, 0]}>
                    <boxGeometry args={[0.04, 3.2, 0.04]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.6} />
                </mesh>
                <mesh position={[0.15, 1.5, 0]}>
                    <boxGeometry args={[0.04, 3.2, 0.04]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.6} />
                </mesh>
                {[0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7].map((y, i) => (
                    <mesh key={i} position={[0, y, 0]}>
                        <boxGeometry args={[0.28, 0.03, 0.04]} />
                        <meshStandardMaterial color={c.lightWood} roughness={0.6} />
                    </mesh>
                ))}
            </group>

            {/* ===== GLOBE ===== */}
            <group position={[3.8, -0.5, 0.5]}>
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

            {/* ===== GRANDFATHER CLOCK ===== */}
            <group position={[-4.5, -0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <mesh position={[0, 1.2, 0]}>
                    <boxGeometry args={[0.5, 2.8, 0.4]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
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
                <mesh position={[0, 2.0, 0.23]} rotation={[0, 0, Math.PI / 4]}>
                    <boxGeometry args={[0.01, 0.12, 0.01]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
                <mesh position={[0, 2.0, 0.23]} rotation={[0, 0, Math.PI / 1.5]}>
                    <boxGeometry args={[0.01, 0.08, 0.01]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
                {/* Pendulum */}
                <mesh position={[0, 0.8, 0.21]}>
                    <planeGeometry args={[0.25, 0.6]} />
                    <meshStandardMaterial color="#0a0a18" transparent opacity={0.5} />
                </mesh>
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

            {/* ===== FLOOR BOOK PILES scattered around ===== */}
            <BookPile position={[-1.5, -0.5, -2.5]} rotation={[0, 0.5, 0]} count={6} />
            <BookPile position={[1.5, -0.5, -2.5]} rotation={[0, -0.3, 0]} count={5} />
            <BookPile position={[-3.5, -0.5, 2.0]} rotation={[0, 0.8, 0]} count={4} />
            <BookPile position={[2.5, -0.5, 1.5]} rotation={[0, -0.5, 0]} count={7} />
            <BookPile position={[0.2, -0.5, -1.0]} rotation={[0, 0.2, 0]} count={3} />

            {/* Scrolls on floor */}
            <Scroll position={[-2.0, -0.48, 1]} rotation={[0, 0.8, 0]} />
            <Scroll position={[3.0, -0.48, -1]} rotation={[0.2, 0, -0.1]} />

            {/* ===== PORTRAIT FRAME ===== */}
            <group position={[0, 2.8, -3.85]}>
                <mesh>
                    <boxGeometry args={[0.7, 0.9, 0.05]} />
                    <meshStandardMaterial color={c.gold} metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.03]}>
                    <planeGeometry args={[0.55, 0.75]} />
                    <meshStandardMaterial color="#1a1a18" />
                </mesh>
            </group>

            {/* ===== FLOATING DUST MOTES ===== */}
            {Array.from({ length: 12 }).map((_, i) => (
                <mesh
                    key={`dust-${i}`}
                    ref={el => { dustRefs.current[i] = el }}
                    position={[-3 + i * 0.6, 1.5 + Math.sin(i) * 0.5, -2 + Math.cos(i) * 2]}
                >
                    <sphereGeometry args={[0.006, 4, 4]} />
                    <meshBasicMaterial color="#ffe8bb" transparent opacity={0.25} />
                </mesh>
            ))}

            {/* ===== CANDLE SMOKE PARTICLES ===== */}
            {[[-1.0, 0.5, -2], [1.0, 0.5, -2], [0.5, 0.5, 0.2]].map((pos, ci) =>
                Array.from({ length: 3 }).map((_, pi) => (
                    <mesh
                        key={`smoke-${ci}-${pi}`}
                        ref={el => { smokeRefs.current[ci * 3 + pi] = el }}
                        position={[pos[0], pos[1], pos[2]]}
                    >
                        <sphereGeometry args={[0.015, 6, 6]} />
                        <meshBasicMaterial color="#998877" transparent opacity={0.08} depthWrite={false} />
                    </mesh>
                ))
            )}

            {/* ===== LIGHTING — Candles only, but BRIGHT and CLEAR ===== */}

            {/* Warm ambient — moderately bright so candles make room clear, not dark */}
            <ambientLight intensity={0.6} color="#ffe8cc" />

            {/* Overhead warm fill — simulates accumulated candle glow bouncing off ceiling */}
            <pointLight
                position={[0, 3.8, 0]}
                intensity={3}
                color="#ffddaa"
                distance={12}
                decay={1}
            />

            {/* Secondary ceiling bounce lights for even illumination */}
            <pointLight
                position={[-3, 3.5, -1]}
                intensity={2}
                color="#ffddaa"
                distance={10}
                decay={1.2}
            />
            <pointLight
                position={[3, 3.5, -1]}
                intensity={2}
                color="#ffddaa"
                distance={10}
                decay={1.2}
            />

            {/* Avatar rim/fill light — warm candle tone from behind */}
            <pointLight
                position={[0, 2.5, -3]}
                intensity={1.5}
                color="#ffd4a0"
                distance={6}
                decay={1.5}
            />

            {/* Front fill for avatar face — subtle warm light */}
            <pointLight
                position={[0, 2, 2]}
                intensity={1}
                color="#fff0dd"
                distance={6}
                decay={1.5}
            />
        </group>
    )
}
