import React, { memo, useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const STATUS_COLORS = {
  ACTIVE: '#00ff88',
  LOW_STOCK: '#ffaa00',
  EMPTY: '#ff4455',
}

const STATUS_BG = {
  ACTIVE: '#003322',
  LOW_STOCK: '#332200',
  EMPTY: '#220011',
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function makeEmptyPlaceholder(data) {
  const W = 256
  const H = 200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Dark muted background
  ctx.fillStyle = '#0a0c10cc'
  roundRect(ctx, 0, 0, W, H, 14)
  ctx.fill()

  // Subtle dashed border
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = '#334455'
  ctx.lineWidth = 1.5
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 13)
  ctx.stroke()
  ctx.setLineDash([])

  // Header bar
  ctx.fillStyle = '#111820cc'
  roundRect(ctx, 0, 0, W, 30, 13)
  ctx.fill()

  // Rack + Slot badge
  ctx.fillStyle = '#445566'
  ctx.font = '11px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`R${data?._rack ?? '?'} · S${data?._slot ?? '?'}`, W - 12, 20)

  // "EMPTY SLOT" center label
  ctx.fillStyle = '#334455'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('EMPTY SLOT', W / 2, H / 2 - 6)

  ctx.fillStyle = '#223344'
  ctx.font = '11px monospace'
  ctx.fillText('No device assigned', W / 2, H / 2 + 14)

  return canvas
}

function makeCardTexture(data) {
  if (data?._empty) return makeEmptyPlaceholder(data)

  const W = 256
  const H = 200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const status = data?.status || 'EMPTY'
  const color = STATUS_COLORS[status] || '#888'
  const bg = STATUS_BG[status] || '#111'

  // Background
  ctx.fillStyle = '#0a0c10ee'
  roundRect(ctx, 0, 0, W, H, 14)
  ctx.fill()

  // Border glow
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 13)
  ctx.stroke()

  // Header bar
  ctx.fillStyle = '#1a2030cc'
  roundRect(ctx, 0, 0, W, 30, 13)
  ctx.fill()

  // Device name (left side of header)
  const rackLabel = data?.device_name || null
  if (rackLabel) {
    ctx.fillStyle = '#00ccff'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(rackLabel.length > 18 ? rackLabel.slice(0, 17) + '…' : rackLabel, 12, 20)
  }

  // Rack + Slot badge (right side of header)
  ctx.fillStyle = '#556677'
  ctx.font = '11px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`R${data?._rack ?? '?'} · S${data?._slot ?? '?'}`, W - 12, 20)

  // Divider under header
  ctx.strokeStyle = color + '55'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 31)
  ctx.lineTo(W, 31)
  ctx.stroke()

  // Status badge
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(W - 96, 38, 84, 22, 8)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(status, W - 54, 53)

  // Ingredient name
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'left'
  const ingredient = data?.ingredient || '—'
  ctx.fillText(ingredient.length > 14 ? ingredient.slice(0, 13) + '…' : ingredient, 12, 72)

  // Divider
  ctx.strokeStyle = '#ffffff22'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(12, 82)
  ctx.lineTo(W - 12, 82)
  ctx.stroke()

  // Weight
  ctx.fillStyle = '#ccddee'
  ctx.font = '12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('⚖  Weight', 12, 100)
  ctx.fillStyle = color
  ctx.font = 'bold 15px monospace'
  ctx.fillText(`${data?.weight_grams ?? 0} g`, 12, 118)

  // Temp
  ctx.fillStyle = '#ccddee'
  ctx.font = '12px monospace'
  ctx.fillText('🌡 Temp', 12, 140)
  ctx.fillStyle = '#aabbcc'
  ctx.font = 'bold 13px monospace'
  ctx.fillText(`${data?.metadata?.temp ?? '--'}°C`, 12, 156)

  // Humidity
  ctx.fillStyle = '#ccddee'
  ctx.font = '12px monospace'
  ctx.fillText('💧 Humidity', 120, 140)
  ctx.fillStyle = '#aabbcc'
  ctx.font = 'bold 13px monospace'
  ctx.fillText(`${data?.metadata?.humidity ?? '--'}%`, 120, 156)

  // Owner
  ctx.fillStyle = '#445566'
  ctx.font = '10px monospace'
  ctx.fillText(`owner: ${data?.owner_id ?? '?'}`, 12, 190)

  return canvas
}

function SlotCard({ position, slotKey, slotData }) {
  const meshRef = useRef()
  const textureRef = useRef()
  const { camera } = useThree()

  const initialTexture = useMemo(() => {
    const canvas = makeCardTexture(slotData)
    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }, [])

  useEffect(() => {
    textureRef.current = initialTexture
  }, [initialTexture])

  useEffect(() => {
    if (!textureRef.current) return
    const canvas = makeCardTexture(slotData)
    textureRef.current.image = canvas
    textureRef.current.needsUpdate = true
  }, [slotData])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position)
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[3.6, 2.85]} />
      <meshBasicMaterial
        map={initialTexture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default memo(SlotCard)
