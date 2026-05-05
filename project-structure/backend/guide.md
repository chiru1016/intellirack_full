# Database Guide

## 1) Current Database Design

IntelliRack server uses MongoDB with Mongoose models. The API and MQTT layers are wired in [intelliRack-server/server.js](intelliRack-server/server.js#L45), [intelliRack-server/server.js](intelliRack-server/server.js#L47), and [intelliRack-server/server.js](intelliRack-server/server.js#L48). DB connection is initialized in [intelliRack-server/server.js](intelliRack-server/server.js#L537).

Main collections and purpose:

1. Users
- Model: [intelliRack-server/models/User.js](intelliRack-server/models/User.js#L3)
- Stores identity and auth-linked profile data.
- Key fields: `name`, `email` (unique), `passwordHash`, `devices` (ObjectId refs to Device), `webhookUrl`.

2. Devices
- Model: [intelliRack-server/models/Device.js](intelliRack-server/models/Device.js#L3)
- One document per physical rack.
- Key fields: `rackId` (unique), `owner` (User ref), online/lastSeen status, `lastWeight`, `lastStatus`, `firmwareVersion`, `ipAddress`, calibration and threshold settings.

3. Ingredient Logs (historical time series)
- Model: [intelliRack-server/models/IngredientLog.js](intelliRack-server/models/IngredientLog.js#L3)
- Stores historical snapshots/events per ingredient per slot.
- Key fields: `user`, `ingredient`, `tagUID`, `device`, `slotId`, `weight`, `status`, `source`, `timestamp`.
- Important indexes: `device+slotId+timestamp` (unique), `user+ingredient+timestamp`, `user+ingredient`.

4. Ingredient Status (current/latest snapshot)
- Model: [intelliRack-server/models/IngredientStatus.js](intelliRack-server/models/IngredientStatus.js#L3)
- Stores latest known state for each slot/device ingredient.
- Key fields: `user`, `ingredient`, `tagUID`, `device`, `slotId`, `weight`, `status`, `lastUpdated`.

5. Alerts
- Model: [intelliRack-server/models/Alert.js](intelliRack-server/models/Alert.js#L3)
- Stores operational alerts such as `LOW_STOCK`, `EMPTY`, `OVERWEIGHT`, `OFFLINE`, `ANOMALY`.
- Key fields: `userId`, `device`, `slotId`, `ingredient`, `type`, `acknowledged`, `createdAt`.

6. NFC Tags
- Model: [intelliRack-server/models/NFCTag.js](intelliRack-server/models/NFCTag.js#L3)
- Maps NFC UID to ingredient/device/slot and usage stats.
- Key fields: `uid` (unique), `ingredient`, `deviceId`, `slotId`, `status`, `readCount`, `writeCount`, `createdBy`.

7. Audit Logs
- Model: [intelliRack-server/models/AuditLog.js](intelliRack-server/models/AuditLog.js#L3)
- Stores action history and metadata.
- Key fields: `user`, `action`, `details`, `timestamp`.

8. Compressed Ingredient Logs (long-term aggregated retention)
- Model: [intelliRack-server/models/CompressedIngredientLog.js](intelliRack-server/models/CompressedIngredientLog.js#L3)
- Aggregated daily data for older detailed logs (`min/max/avg/count`).
- Used for retention optimization and trend queries.

9. Legacy generic Log
- Model: [intelliRack-server/models/Log.js](intelliRack-server/models/Log.js#L3)
- Exists, but core ingredient endpoints currently use `IngredientLog`.

## 2) What Data Is Being Stored

Real-time operational data:
- Device heartbeat/status: online state, `lastSeen`, `lastWeight`, `lastStatus`, `mqttConnected` in Device.
- Latest slot ingredient state in IngredientStatus.

Historical data:
- Per-event/per-change ingredient records in IngredientLog, including weight/status/time/slot/tagUID.
- Alert lifecycle in Alert.
- Audit actions in AuditLog.
- Compressed historical summaries in CompressedIngredientLog.

User ownership model:
- Device has owner ref to User.
- User keeps devices array.
- Most API reads are scoped by authenticated user.

Ingredient query surfaces:
- Unique ingredient names: [intelliRack-server/routes/ingredients.js](intelliRack-server/routes/ingredients.js#L9)
- Ingredient summary: [intelliRack-server/routes/ingredients.js](intelliRack-server/routes/ingredients.js#L22)
- Ingredient-specific logs: [intelliRack-server/routes/ingredients.js](intelliRack-server/routes/ingredients.js#L80)

## 3) How Ingredients Are Added (Actual Flow)

Primary path is MQTT ingestion from devices.

1. MQTT message enters handler
- Entry point: [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L686)

2. Ingredient field validation/normalization
- Normalization utility: [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L242)
- If ingredient is missing/empty, it does not create ingredient records; it only emits status updates.

3. Batch processing decision
- If ingredient is valid and payload is log-worthy, handler calls batch processor:
- [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L967)
- Batch function: [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L1055)

4. What batch processor does
- Compares against last log to avoid noisy writes.
- Detects events like restock, batch usage, sensor anomalies.
- Buffers new IngredientLog entries.
- Buffers latest IngredientStatus state.
- Triggers alerts when needed (`LOW_STOCK`, `EMPTY`, etc).

5. Database flush from buffers
- Flush function: [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L358)
- Writes IngredientLog via `insertMany`.
- Upserts IngredientStatus via `findOneAndUpdate`.
- Writes alerts and audit entries.

6. Read APIs for dashboard
- Dashboard and ingredient screens mostly read IngredientLog-based summaries/logs from:
- [intelliRack-server/routes/ingredients.js](intelliRack-server/routes/ingredients.js#L22)
- [intelliRack-server/routes/ingredients.js](intelliRack-server/routes/ingredients.js#L80)

NFC-assisted path:
- NFC read handling can update IngredientStatus when a known tag is detected:
- [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js#L1572)
- NFC APIs are under [intelliRack-server/routes/nfc.js](intelliRack-server/routes/nfc.js#L1)

Important behavior note:
- IngredientLog is the main historical source powering analytics and summaries.
- IngredientStatus is the current snapshot.
- If device messages omit ingredient, you may see live status updates but no new ingredient history rows.

## 6) Supabase Rack-Wise Twin Pipeline

To stream MQTT data for CAD/Three.js digital twin rendering, the server now mirrors processed batch data to Supabase.

Server integration:
- Service file: [intelliRack-server/services/supabase.js](intelliRack-server/services/supabase.js)
- MQTT batch sync point: [intelliRack-server/controllers/mqttHandler.js](intelliRack-server/controllers/mqttHandler.js)

Supabase schema and retention automation:
- SQL file: [intelliRack-server/supabase/schema.sql](intelliRack-server/supabase/schema.sql)
- Setup notes: [intelliRack-server/supabase/README.md](intelliRack-server/supabase/README.md)

Tables and purpose:
1. rack_telemetry_live
- High-frequency telemetry rows from MQTT handler.

2. rack_current_state
- Latest state per (rack_id, slot_id), ideal for digital twin overlays.

3. rack_telemetry_archive
- Archived historical rows.

Retention policy implemented in SQL:
1. Older than 1 hour
- Moved from rack_telemetry_live to rack_telemetry_archive.

2. Older than 3 hours
- Deleted from rack_telemetry_archive.

3. Scheduler
- pg_cron runs every 5 minutes using function archive_and_trim_rack_telemetry().

Rack separation:
- Every telemetry row includes rack_id and slot_id.
- Current state is keyed by composite primary key (rack_id, slot_id).

## 4) Entity Relationships

- User 1-to-many Device
- Device 1-to-many IngredientLog
- Device+slot tracks one latest IngredientStatus snapshot
- Device 1-to-many Alert
- User 1-to-many NFCTag (through `createdBy`), and NFCTag also references Device
- User 1-to-many AuditLog

## 5) Design Observations

- Strong separation between latest state (IngredientStatus) and history (IngredientLog), which is good for performance.
- Alert and audit trails are explicit, enabling monitoring and traceability.
- Compression model supports long-term storage control.
- Minor schema/code mismatch to review: write path sets `isOnline` inside IngredientStatus upsert, but this field is not declared in IngredientStatus schema.
