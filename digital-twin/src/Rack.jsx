import React from 'react'
import { useGLTF } from '@react-three/drei'
import SlotCard from './SlotCard'

const SLOT_Y_OFFSETS = [9.7, 6.5, 3.1]
const CARD_Z_OFFSET = 0.3

export default function Rack({ position, rackIndex, slots }) {
  const { scene } = useGLTF('/rack.glb')

  return (
    <group position={position}>
      <primitive object={scene.clone()} scale={[1, 1, 1]} />
      {slots.map((slotData, i) => {
        const slotKey = `rack${rackIndex}:slot${i + 1}`
        return (
          <SlotCard
            key={slotKey}
            slotKey={slotKey}
            position={[0, SLOT_Y_OFFSETS[i], CARD_Z_OFFSET]}
            slotData={{ ...slotData, _rack: rackIndex + 1, _slot: i + 1 }}
          />
        )
      })}
    </group>
  )
}

useGLTF.preload('/rack.glb')
