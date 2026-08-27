# Position Configurations

## Rack Positions (App.jsx)
```javascript
const RACK_CONFIGS = [
  { rackId: 'RACK_A1', position: [-6.5, 0, 0] },
  { rackId: 'RACK_A2', position: [0, 0, 0] },
  { rackId: 'RACK_B1', position: [6.5, 0, 0] },
]
```

## Data Card Positions (Rack.jsx)
```javascript
const SLOT_Y_OFFSETS = [8, 5.5, 3.1]
const CARD_Z_OFFSET = 0.3
```
- Top slot: Y = 8
- Middle slot: Y = 5.5
- Bottom slot: Y = 3.1

## Data Card Size (SlotCard.jsx)
```javascript
<planeGeometry args={[3.6, 2.55]} />
```

## Camera (App.jsx)
```javascript
camera={{ position: [0, 4, 14], fov: 55 }}
target={[0, 3.5, 0]}
```

## Environment (App.jsx)
- Background: #f5f2eb (warm off-white)
- Fog: 12 to 35
- Grid: 30x30 units, 1 unit cells, 5 unit sections