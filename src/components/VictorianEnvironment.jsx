import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function VictorianEnvironment() {
    const candleLightRefs = useRef([])
    const candleFlameRefs = useRef([])

    useFrame((state) => {
        const time = state.clock.elapsedTime

        // Flickering candle lights
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
    })

    const c = {
        darkWood: '#3d2517',
        medWood: '#6b4226',
        lightWood: '#8b6340',
        floorDark: '#5a3a24',
        floorLight: '#6d4830',
        wall: '#4a3020',
        gold: '#b8860b',
        brass: '#c4972a',
        cream: '#f5f0e0',
        leather: '#5a3420',
        rugMain: '#6b1a1a',
        rugBorder: '#8b6914',
    }

    const bookColors = [
        '#5a0a0a', '#0a2a4a', '#1a3a1a', '#3a1a3a', '#5a3a0a',
        '#2a1a0a', '#0a3a3a', '#4a0a2a', '#3a3a0a', '#1a1a3a',
    ]

    const BookRow = ({ y, xOffset = 0, count = 7 }) => (
        <group position={[xOffset, y, 0.28]}>
            {Array.from({ length: count }).map((_, i) => {
                const w = 0.08 + Math.sin(i * 7.3) * 0.04
                const h = 0.28 + Math.sin(i * 3.7) * 0.08
                const x = -0.7 + i * (1.4 / count)
                return (
                    <mesh key={i} position={[x, h / 2 + 0.02, 0]}>
                        <boxGeometry args={[w, h, 0.18]} />
                        <meshStandardMaterial color={bookColors[i % bookColors.length]} roughness={0.85} />
                    </mesh>
                )
            })}
        </group>
    )

    let candleIndex = 0
    const Candelabra = ({ position, tall = false }) => {
        const idx = candleIndex++
        const candleY = tall ? 0.2 : 0.12
        const candleH = tall ? 0.35 : 0.28
        const flameY = tall ? 0.58 : 0.44
        const lightY = tall ? 0.65 : 0.5
        const stemHeight = tall ? 0.8 : 0.55
        return (
            <group position={position}>
                <mesh position={[0, -0.45, 0]}>
                    <cylinderGeometry args={[0.12, 0.16, 0.06, 12]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.15, 0]}>
                    <cylinderGeometry args={[0.025, 0.04, stemHeight, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, candleY + 0.16, 0]}>
                    <cylinderGeometry args={[0.02, 0.025, candleH, 8]} />
                    <meshStandardMaterial color={c.cream} roughness={0.95} />
                </mesh>
                <mesh ref={el => { candleFlameRefs.current[idx] = el }} position={[0, flameY, 0]}>
                    <coneGeometry args={[0.018, 0.06, 8]} />
                    <meshBasicMaterial color="#ffaa22" />
                </mesh>
                <mesh position={[0, flameY - 0.01, 0]}>
                    <sphereGeometry args={[0.035, 8, 8]} />
                    <meshBasicMaterial color="#ff8800" transparent opacity={0.35} />
                </mesh>
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

    const TallBookshelf = ({ position, rotation = [0, 0, 0], width = 2.2, shelves = 6, booksPerShelf = 8 }) => (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 2, 0]}>
                <boxGeometry args={[width, 4, 0.55]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.65} />
            </mesh>
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.1 + i * (3.2 / shelves)
                return (
                    <mesh key={`shelf-${i}`} position={[0, y, 0.05]}>
                        <boxGeometry args={[width - 0.2, 0.04, 0.5]} />
                        <meshStandardMaterial color={c.medWood} roughness={0.6} />
                    </mesh>
                )
            })}
            {Array.from({ length: shelves }).map((_, i) => {
                const y = 0.15 + i * (3.2 / shelves)
                return <BookRow key={`books-${i}`} y={y} count={booksPerShelf} />
            })}
            <mesh position={[0, 4.05, 0]}>
                <boxGeometry args={[width + 0.2, 0.12, 0.6]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.6} />
            </mesh>
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

    candleIndex = 0

    return (
        <group position={[0, 0, 0]}>
            {/* FLOOR */}
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

            {/* Simple rug */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
                <planeGeometry args={[3.2, 4.5]} />
                <meshStandardMaterial color={c.rugMain} roughness={0.95} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.475, 0]}>
                <planeGeometry args={[2.8, 4.0]} />
                <meshStandardMaterial color={c.rugBorder} roughness={0.95} />
            </mesh>

            {/* WALLS */}
            <mesh position={[0, 1.75, -4]} receiveShadow>
                <planeGeometry args={[12, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>
            <mesh position={[-5, 1.75, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>
            <mesh position={[5, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[10, 5.5]} />
                <meshStandardMaterial color={c.wall} roughness={0.92} />
            </mesh>

            {/* CEILING */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
                <planeGeometry args={[12, 12]} />
                <meshStandardMaterial color="#3a2a18" roughness={0.9} />
            </mesh>
            {[-2, 0, 2].map((x, i) => (
                <mesh key={`beam-${i}`} position={[x, 3.9, 0]}>
                    <boxGeometry args={[0.2, 0.15, 12]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.8} />
                </mesh>
            ))}

            {/* Wainscoting */}
            <mesh position={[0, 0.25, -3.95]}>
                <boxGeometry args={[12, 1.5, 0.1]} />
                <meshStandardMaterial color={c.darkWood} roughness={0.7} />
            </mesh>

            {/* 2 BOOKSHELVES — left and right of avatar */}
            <TallBookshelf position={[-2.2, -0.5, -3.5]} shelves={7} booksPerShelf={9} width={2.4} />
            <TallBookshelf position={[2.2, -0.5, -3.5]} shelves={7} booksPerShelf={9} width={2.4} />

            {/* READING TABLE */}
            <group position={[0.5, -0.5, 0.2]}>
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.6, 0.07, 0.8]} />
                    <meshStandardMaterial color={c.medWood} roughness={0.5} metalness={0.05} />
                </mesh>
                <mesh position={[0, 0.72, 0]}>
                    <boxGeometry args={[1.65, 0.035, 0.85]} />
                    <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                </mesh>
                {[[-0.7, -0.35], [-0.7, 0.35], [0.7, -0.35], [0.7, 0.35]].map(([x, z], i) => (
                    <mesh key={`tl-${i}`} position={[x, 0.35, z]}>
                        <cylinderGeometry args={[0.035, 0.045, 0.7, 8]} />
                        <meshStandardMaterial color={c.darkWood} roughness={0.6} />
                    </mesh>
                ))}

                {/* Open book */}
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
                </group>

                {/* Quill pen holder */}
                <mesh position={[0.55, 0.85, -0.2]}>
                    <cylinderGeometry args={[0.035, 0.04, 0.1, 8]} />
                    <meshStandardMaterial color={c.brass} metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0.55, 0.93, -0.2]} rotation={[0.3, 0, 0.1]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.22, 4]} />
                    <meshStandardMaterial color="#f5f5f0" />
                </mesh>

                {/* Table candelabra */}
                <Candelabra position={[0.5, 0.79, -0.1]} tall />
            </group>

            {/* 3 CANDELABRAS total (including table one above) */}
            <Candelabra position={[-1.0, -0.05, -2.0]} tall />
            <Candelabra position={[1.0, -0.05, -2.0]} tall />

            {/* Portrait frame */}
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

            {/* ===== LIGHTING — 6 lights total ===== */}

            {/* 1. Warm ambient */}
            <ambientLight intensity={0.6} color="#ffe8cc" />

            {/* 2. Overhead fill */}
            <pointLight
                position={[0, 3.8, 0]}
                intensity={3}
                color="#ffddaa"
                distance={12}
                decay={1}
            />

            {/* 3. Avatar rim light */}
            <pointLight
                position={[0, 2.5, -3]}
                intensity={1.5}
                color="#ffd4a0"
                distance={6}
                decay={1.5}
            />

            {/* 4. Front fill for avatar face */}
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
