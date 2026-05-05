Supabase setup for IntelliRack rack-wise digital-twin telemetry

1) Add these environment variables in your backend environment:
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_TELEMETRY_TABLE=rack_telemetry_live
SUPABASE_CURRENT_STATE_TABLE=rack_current_state

2) Run the SQL in this order inside Supabase SQL editor:
- schema.sql

3) What gets stored:
- rack_telemetry_live: full live stream events from MQTT handler.
- rack_current_state: latest state per rack and slot for real-time twin overlays.
- rack_telemetry_archive: archived events moved from live table.

4) Rack-wise separation:
- Each row has rack_id and slot_id.
- Current twin state is keyed by (rack_id, slot_id).
- Use get_rack_twin_state(rack_id) or query rack_twin_current view.

5) Retention behavior implemented:
- Older than 1 hour: moved from rack_telemetry_live to rack_telemetry_archive.
- Older than 3 hours: deleted from rack_telemetry_archive.
- Schedule: every 5 minutes via pg_cron.

6) Notes:
- Service role key should only be used on backend.
- RLS policies allow users to read only their own rows (owner_id = auth.uid()).
