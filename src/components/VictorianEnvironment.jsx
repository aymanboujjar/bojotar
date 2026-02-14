import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Bright, warm Victorian library — Ada Lovelace's era (1830s-1850s)
export default function VictorianEnvironment() {
    const candleFlameRefs = useRef([])
    const candleLightRefs = useRef([])

    useFrame((state) => {
        const time = state.clock.elapsedTime

        // Gentle candle flicker
        candleLightRefs.current.forEach((ref, i) => {
            if (ref) {
                ref.intensity = 3 + Math.sin(time * (5 + i * 1.1)) * 0.5
            }
        })
        candleFlameRefs.current.forEach((ref, i) => {
            if (ref) {
                ref.scale.y = 1 + Math.sin(time * (8 + i * 1.3)) * 0.12
                ref.rotation.z = Math.sin(time * (5 + i * 0.6)) * 0.08
            }
        })
    })

    const c = {
        darkWood: '#5a3a20',
        medWood: '#8b6340',
        lightWood: '#a0784a',
        floor: '#9a7a55',
        floorAlt: '#8a6a48',
        wallUpper: '#e8dcc0',     // cream/warm white — bright!
        wallLower: '#c8b898',     // warm tan wainscoting
        molding: '#d4c4a0',
        gold: '#c8a040',
        brass: '#d4a830',
        cream: '#f5f0e0',
        green: '#2a5a28',
        rugMain: '#8b2020',
        rugBorder: '#c8a040',
        leather: '#6a3a1a',
    }

    const bookColors = [
        '#7a1818', '#1a3a5a', '#2a4a2a', '#4a2040', '#6a4a10',
        '#8a3010', '#1a4a4a', '#5a1a3a', '#3a4a18', '#2a2050',
        '#1a5040', '#6a2a08', '#4a3a60', '#804020', '#2a3a6a',
    ]

    // Books row
    const BookRow = ({ y, count = 8 }) => (
        <group position={[0, y, 0.28]}>
            {Array.from({ length: count }).map((_, i) => {
                const w = 0.07 + Math.sin(i * 7.3) * 0.03
                const h = 0.26 + Math.sin(i * 3.7) * 0.08
                const x = -0.75 + i * (1.5 / count)
                const tilt = (Math.sin(i * 5.1) * 0.06)
                return (
                    <mesh key={i} position={[x, h / 2 + 0.02, 0]} rotation={[0, 0, tilt]}>
                        <boxGeometry args={[w, h, 0.16]} />
                        <meshStandardMaterial color={bookColors[i % bookColors.length]} roughness={0.8} />
                    </mesh>
                )
            })}
        </group>
    )

    // Tall bookshelf — floor to near-ceiling
    const TallBookshelf = ({ position, rotation = [0, 0, 0], width = 2.2, shelves = 5, booksPerShelf = 9 }) => (
        <group position={position} rotation={rotation}>
            {/* Back panel */}
            <mesh position={[0, 2.1, 0]}>
                <boxGeometry args={[width, 4.2, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.6} />
            </mesh>
            {/* Shelves */}
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.15 + i * (3.6 / shelves)
                return (
                    <mesh key={`s-${i}`} position={[0, y, 0.08]}>
                        <boxGeometry args={[width - 0.15, 0.045, 0.5]} />
                        <meshStandardMaterial color={c.medWood} roughness={0.55} />
                    </mesh>
                )
            })}
            {/* Books */}
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.22 + i * (3.6 / shelves)
                return <BookRow key={`b-${i}`} y={y} count={booksPerShelf} />
            })}
            {/* Crown molding */}
            <mesh position={[0, 4.25, 0.05]}>
                <boxGeometry args={[width + 0.18, 0.12, 0.6]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.55} />
            </mesh>
            {/* Base molding */}
            <mesh position={[0, 0.04, 0.05]}>
                <boxGeometry args={[width + 0.1, 0.1, 0.58]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.55} />
            </mesh>
            {/* Side panels */}
            <mesh position={[-(width / 2 + 0.03), 2.1, 0]}>
                <boxGeometry args={[0.07, 4.2, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.55} />
            </mesh>
            <mesh position={[(width / 2 + 0.03), 2.1, 0]}>
                <boxGeometry args={[0.07, 4.2, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.55} />
            </mesh>
        </group>
    )

    // Candelabra
    let candleIdx = 0
    const Candelabra = ({ position }) => {
        const idx = candleIdx++
        return (
            <group position={position}>
                <mesh position={[0, -0.4, 0]}>
                    <cylinderGeometry args={[0.1, 0.13, 0.05, 10]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.35} />
                </mesh>
                <mesh position={[0, -0.1, 0]}>
                    <cylinderGeometry args={[0.02, 0.035, 0.65, 6]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.25, 0]}>
                    <cylinderGeometry args={[0.018, 0.022, 0.3, 6]} />
                    <meshStandardMaterial color={c.cream} roughness={0.95} />
                </mesh>
                <mesh ref={el => { candleFlameRefs.current[idx] = el }} position={[0, 0.42, 0]}>
                    <coneGeometry args={[0.014, 0.05, 6]} />
                    <meshBasicMaterial color="#ffcc44" />
                </mesh>
                <pointLight
                    ref={el => { candleLightRefs.current[idx] = el }}
                    position={[0, 0.48, 0]}
                    color="#ffe8aa"
                    intensity={3}
                    distance={5}
                    decay={1.5}
                />
            </group>
        )
    }

    // Window with bright daylight — tall Victorian style
    const Window = ({ position, rotation = [0, 0, 0] }) => (
        <group position={position} rotation={rotation}>
            {/* Window frame */}
            <mesh>
                <boxGeometry args={[1.6, 2.6, 0.14]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.5} />
            </mesh>
            {/* Glass panes — bright sky light */}
            <mesh position={[-0.36, 0.35, 0.06]}>
                <planeGeometry args={[0.62, 0.9]} />
                <meshBasicMaterial color="#d8eeff" />
            </mesh>
            <mesh position={[0.36, 0.35, 0.06]}>
                <planeGeometry args={[0.62, 0.9]} />
                <meshBasicMaterial color="#d0eaff" />
            </mesh>
            <mesh position={[-0.36, -0.6, 0.06]}>
                <planeGeometry args={[0.62, 0.9]} />
                <meshBasicMaterial color="#c8e4ff" />
            </mesh>
            <mesh position={[0.36, -0.6, 0.06]}>
                <planeGeometry args={[0.62, 0.9]} />
                <meshBasicMaterial color="#d4ecff" />
            </mesh>
            {/* Mullions (cross bars) */}
            <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[0.05, 2.5, 0.03]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.12, 0.07]}>
                <boxGeometry args={[1.5, 0.05, 0.03]} />
                <meshStandardMaterial color={c.lightWood} roughness={0.5} />
            </mesh>
            {/* Curtain rod */}
            <mesh position={[0, 1.45, 0.12]}>
                <cylinderGeometry args={[0.018, 0.018, 2.0, 6]} rotation={[0, 0, Math.PI / 2]} />
                <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Curtains — pulled aside */}
            <mesh position={[-0.88, 0, 0.1]}>
                <boxGeometry args={[0.2, 2.6, 0.05]} />
                <meshStandardMaterial color="#8a2020" roughness={0.85} />
            </mesh>
            <mesh position={[0.88, 0, 0.1]}>
                <boxGeometry args={[0.2, 2.6, 0.05]} />
                <meshStandardMaterial color="#8a2020" roughness={0.85} />
            </mesh>
        </group>
    )

    candleIdx = 0

    return (
        <group position={[0, 0, 0]} scale={1.5}>

            {/* ===== FLOOR — polished wood planks ===== */}
            {Array.from({ length: 10 }).map((_, i) => (
                <mesh key={`p-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-5.4 + i * 1.2, -0.5, 0]} receiveShadow>
                    <planeGeometry args={[1.15, 14]} />
                    <meshStandardMaterial
                        color={i % 2 === 0 ? c.floor : c.floorAlt}
                        roughness={0.7}
                        metalness={0.05}
                    />
                </mesh>
            ))}

            {/* Persian rug */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
                <planeGeometry args={[4.5, 6.0]} />
                <meshStandardMaterial color={c.rugMain} roughness={0.95} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.477, 0]}>
                <planeGeometry args={[4.0, 5.4]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.474, 0]}>
                <planeGeometry args={[3.4, 4.8]} />
                <meshStandardMaterial color="#5a1010" roughness={0.95} />
            </mesh>

            {/* ===== WALLS — bright cream upper, warm wood wainscoting lower ===== */}

            {/* Back wall — upper (bright cream) */}
            <mesh position={[0, 2.8, -4]}>
                <planeGeometry args={[12, 3]} />
                <meshStandardMaterial color={c.wallUpper} roughness={0.85} />
            </mesh>
            {/* Back wall — lower wainscoting */}
            <mesh position={[0, 0.5, -3.97]}>
                <boxGeometry args={[12, 1.6, 0.08]} />
                <meshStandardMaterial color={c.wallLower} roughness={0.7} />
            </mesh>
            {/* Chair rail molding */}
            <mesh position={[0, 1.35, -3.94]}>
                <boxGeometry args={[12, 0.06, 0.06]} />
                <meshStandardMaterial color={c.molding} roughness={0.5} />
            </mesh>

            {/* Left wall */}
            <mesh position={[-5, 2.8, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[10, 3]} />
                <meshStandardMaterial color={c.wallUpper} roughness={0.85} />
            </mesh>
            <mesh position={[-4.97, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[10, 1.6, 0.08]} />
                <meshStandardMaterial color={c.wallLower} roughness={0.7} />
            </mesh>

            {/* Right wall */}
            <mesh position={[5, 2.8, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[10, 3]} />
                <meshStandardMaterial color={c.wallUpper} roughness={0.85} />
            </mesh>
            <mesh position={[4.97, 0.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <boxGeometry args={[10, 1.6, 0.08]} />
                <meshStandardMaterial color={c.wallLower} roughness={0.7} />
            </mesh>

            {/* ===== CEILING — light with exposed beams ===== */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.2, 0]}>
                <planeGeometry args={[12, 12]} />
                <meshStandardMaterial color="#e8e0d0" roughness={0.85} />
            </mesh>
            {[-2.5, 0, 2.5].map((x, i) => (
                <mesh key={`beam-${i}`} position={[x, 4.1, 0]}>
                    <boxGeometry args={[0.18, 0.12, 12]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.7} />
                </mesh>
            ))}
            {/* Crown molding */}
            <mesh position={[0, 4.15, -3.96]}>
                <boxGeometry args={[12, 0.1, 0.1]} />
                <meshStandardMaterial color={c.molding} roughness={0.5} />
            </mesh>

            {/* ===== WINDOWS — letting in bright daylight ===== */}
            {/* Back wall windows */}
            <Window position={[-2.8, 2.2, -3.88]} />
            <Window position={[2.8, 2.2, -3.88]} />

            {/* Left wall window */}
            <Window position={[-4.88, 2.2, -1.5]} rotation={[0, Math.PI / 2, 0]} />

            {/* Right wall window */}
            <Window position={[4.88, 2.2, -1.5]} rotation={[0, -Math.PI / 2, 0]} />

            {/* ===== BOOKSHELVES — flanking the avatar ===== */}
            <TallBookshelf position={[-3.5, -0.5, -3.5]} shelves={6} booksPerShelf={12} width={2.4} />
            <TallBookshelf position={[3.5, -0.5, -3.5]} shelves={6} booksPerShelf={12} width={2.4} />

            {/* Side wall bookshelves */}
            <group position={[-4.7, -0.5, 1.5]} rotation={[0, Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={5} booksPerShelf={10} width={2.6} />
            </group>
            <group position={[4.7, -0.5, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
                <TallBookshelf position={[0, 0, 0]} shelves={5} booksPerShelf={10} width={2.6} />
            </group>

            {/* ===== PORTRAIT FRAME above center ===== */}
            <group position={[0, 3.0, -3.88]}>
                <mesh>
                    <boxGeometry args={[1.0, 1.3, 0.06]} />
                    <meshStandardMaterial color={c.gold} metalness={0.5} roughness={0.45} />
                </mesh>
                <mesh position={[0, 0, 0.035]}>
                    <planeGeometry args={[0.8, 1.1]} />
                    <meshStandardMaterial color="#2a1a10" />
                </mesh>
            </group>

            {/* ===== WALL CANDELABRAS ===== */}
            <Candelabra position={[-4.6, 1.2, -2.5]} />
            <Candelabra position={[4.6, 1.2, -2.5]} />
            <Candelabra position={[-4.6, 1.2, 1.5]} />
            <Candelabra position={[4.6, 1.2, 1.5]} />

            {/* ===== LIGHTING — bright, warm, well-lit library ===== */}

            {/* Strong warm ambient — this is a BRIGHT room */}
            <ambientLight intensity={0.8} color="#fff5e8" />

            {/* Sunlight through windows — main light source */}
            <directionalLight
                position={[3, 5, 4]}
                intensity={1.5}
                color="#fff8e8"
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />

            {/* Window light spill — left */}
            <pointLight
                position={[-4.5, 2.5, -1.5]}
                intensity={2}
                color="#e8f0ff"
                distance={8}
                decay={1.5}
            />

            {/* Window light spill — right */}
            <pointLight
                position={[4.5, 2.5, -1.5]}
                intensity={2}
                color="#e8f0ff"
                distance={8}
                decay={1.5}
            />

            {/* Front fill — soft warm light on avatar face */}
            <pointLight
                position={[0, 2, 3]}
                intensity={1.2}
                color="#fff0dd"
                distance={7}
                decay={1.5}
            />

            {/* Overhead bounce */}
            <pointLight
                position={[0, 4, 0]}
                intensity={1}
                color="#fff5e0"
                distance={10}
                decay={1.2}
            />
        </group>
    )
}
