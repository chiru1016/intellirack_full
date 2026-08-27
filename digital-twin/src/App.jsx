import React, { useCallback, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import Rack from './Rack'
import { useTelemetry } from './useTelemetry'

const SLOTS_PER_RACK = 3
const TOTAL_RACKS = 3
const TOTAL_SLOTS = TOTAL_RACKS * SLOTS_PER_RACK // always 9
const RACK_SPACING = 6.5

const RACK_POSITIONS = [
  [-RACK_SPACING, 0, 0],
  [0,             0, 0],
  [RACK_SPACING,  0, 0],
]

function emptySlot() {
  return { _empty: true, device_name: null, ingredient: null, weight_grams: 0, status: 'EMPTY', owner_id: null, metadata: {} }
}

// Fill a fixed 9-slot grid with real device data; rest are empty placeholders
function buildFixedGrid(devices) {
  const grid = Array.from({ length: TOTAL_SLOTS }, (_, i) => devices[i] ?? emptySlot())
  // Split into 3 racks of 3
  return [
    grid.slice(0, 3),
    grid.slice(3, 6),
    grid.slice(6, 9),
  ]
}

function Scene({ onDeviceCount }) {
  const [devices, setDevices] = useState([])

  const handleUpdate = useCallback((data) => {
    setDevices(data)
    onDeviceCount(data.length)
  }, [onDeviceCount])

  useTelemetry(handleUpdate)

  const racks = buildFixedGrid(devices)

  return (
    <>
      <color attach="background" args={['#f5f2eb']} />
      <fog attach="fog" args={['#f5f2eb', 12, 35]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#fff5e6" />
      <Environment preset="apartment" />
      <Grid
        position={[0, 0, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#888888"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#aaaaaa"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />

      {racks.map((slots, rackIndex) => (
        <Rack
          key={rackIndex}
          rackIndex={rackIndex}
          position={RACK_POSITIONS[rackIndex]}
          slots={slots}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={true}
        minDistance={2}
        maxDistance={18}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 3.5, 0]}
      />
    </>
  )
}

export default function App() {
  const [deviceCount, setDeviceCount] = useState(0)

  const handleDeviceCount = useCallback((count) => setDeviceCount(count), [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, #f5f2eeee, transparent)',
        fontFamily: "'Space Mono', monospace",
        pointerEvents: 'none',
      }}>
        <div>
          <div style={{ color: '#00aa66', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2 }}>
            ● LIVE
          </div>
          <div style={{ color: '#1a1a1a', fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800, letterSpacing: -0.5 }}>
            Rack Telemetry Dashboard
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#556677', fontSize: 11 }}>
            {TOTAL_RACKS} RACKS · {deviceCount}/{TOTAL_SLOTS} ACTIVE
          </div>
          <div style={{ color: '#8899aa', fontSize: 10, marginTop: 2 }}>Polling every 2s</div>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 24, left: 24, zIndex: 10,
        display: 'flex', gap: 16, fontFamily: "'Space Mono', monospace",
        pointerEvents: 'none',
      }}>
        {[['ACTIVE', '#00aa66'], ['LOW_STOCK', '#cc8800'], ['EMPTY', '#cc3355']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ color: '#556677', fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: 24, right: 24, zIndex: 10,
        fontFamily: "'Space Mono', monospace", color: '#aabbcc', fontSize: 10,
        textAlign: 'right', lineHeight: 1.8, pointerEvents: 'none',
      }}>
        Drag to orbit · Scroll to zoom
      </div>

      <Canvas
        camera={{ position: [0, 4, 14], fov: 55 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#f5f2eb' }}
      >
        <Suspense fallback={null}>
          <Scene onDeviceCount={handleDeviceCount} />
        </Suspense>
      </Canvas>
    </div>
  )
}
