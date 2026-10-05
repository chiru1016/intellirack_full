const { Pool } = require("pg");

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const TELEMETRY_TABLE =
	process.env.POSTGRES_TELEMETRY_TABLE || "rack_telemetry_live";
const CURRENT_STATE_TABLE =
	process.env.POSTGRES_CURRENT_STATE_TABLE || "rack_current_state";

const enabled = Boolean(POSTGRES_URL || process.env.PGHOST);
const pool = enabled
	? new Pool({
			...(POSTGRES_URL ? { connectionString: POSTGRES_URL } : {}),
			max: Number(process.env.PG_POOL_MAX || 10),
			ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
		})
	: null;

// Kept for compatibility with the existing MQTT handler. It now indicates
// whether the local PostgreSQL telemetry store is configured.
function isSupabaseEnabled() {
	return enabled;
}

const telemetryRecordColumns = `
	rack_id text,
	slot_id integer,
	owner_id text,
	ingredient text,
	tag_uid text,
	weight_grams double precision,
	status text,
	event_time timestamptz,
	mongo_device_id text,
	metadata jsonb`;

async function pushTelemetryBatch(rows) {
	if (!enabled || !Array.isArray(rows) || rows.length === 0) {
		return { skipped: true, count: 0 };
	}

	const query = `
		INSERT INTO ${TELEMETRY_TABLE} (
			rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
			status, event_time, mongo_device_id, metadata
		)
		SELECT rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
			status, event_time, mongo_device_id, metadata
		FROM jsonb_to_recordset($1::jsonb) AS telemetry(${telemetryRecordColumns})`;

	try {
		await pool.query(query, [JSON.stringify(rows)]);
	} catch (error) {
		throw new Error(`PostgreSQL telemetry insert failed: ${error.message}`);
	}

	return { skipped: false, count: rows.length };
}

async function upsertRackCurrentState(rows) {
	if (!enabled || !Array.isArray(rows) || rows.length === 0) {
		return { skipped: true, count: 0 };
	}

	const query = `
		INSERT INTO ${CURRENT_STATE_TABLE} (
			rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
			status, event_time, mongo_device_id, metadata
		)
		SELECT rack_id, slot_id, owner_id, ingredient, tag_uid, weight_grams,
			status, event_time, mongo_device_id, metadata
		FROM jsonb_to_recordset($1::jsonb) AS state(${telemetryRecordColumns})
		ON CONFLICT (rack_id, slot_id) DO UPDATE SET
			owner_id = EXCLUDED.owner_id,
			ingredient = EXCLUDED.ingredient,
			tag_uid = EXCLUDED.tag_uid,
			weight_grams = EXCLUDED.weight_grams,
			status = EXCLUDED.status,
			event_time = EXCLUDED.event_time,
			mongo_device_id = EXCLUDED.mongo_device_id,
			metadata = EXCLUDED.metadata,
			updated_at = now()`;

	try {
		await pool.query(query, [JSON.stringify(rows)]);
	} catch (error) {
		throw new Error(`PostgreSQL current-state upsert failed: ${error.message}`);
	}

	return { skipped: false, count: rows.length };
}

async function fetchRackTwinCurrentState() {
	if (!enabled) return [];

	try {
		const { rows } = await pool.query(`
			SELECT *
			FROM ${CURRENT_STATE_TABLE}
			ORDER BY rack_id ASC, slot_id ASC`);
		return rows;
	} catch (error) {
		throw new Error(`PostgreSQL current-state fetch failed: ${error.message}`);
	}
}

/*
Legacy Supabase implementation, intentionally disabled during the local
PostgreSQL migration. Restore this block as active code only if rollback is
required.

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEMETRY_TABLE =
	process.env.SUPABASE_TELEMETRY_TABLE || "rack_telemetry_live";
const CURRENT_STATE_TABLE =
	process.env.SUPABASE_CURRENT_STATE_TABLE || "rack_current_state";

const enabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = enabled
	? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		})
	: null;

function isSupabaseEnabled() {
	return enabled;
}

async function pushTelemetryBatch(rows) {
	if (!enabled || !Array.isArray(rows) || rows.length === 0) {
		return { skipped: true, count: 0 };
	}

	const { error } = await supabase.from(TELEMETRY_TABLE).insert(rows);
	if (error) {
		throw new Error(`Supabase telemetry insert failed: ${error.message}`);
	}

	return { skipped: false, count: rows.length };
}

async function upsertRackCurrentState(rows) {
	if (!enabled || !Array.isArray(rows) || rows.length === 0) {
		return { skipped: true, count: 0 };
	}

	const { error } = await supabase
		.from(CURRENT_STATE_TABLE)
		.upsert(rows, { onConflict: "rack_id,slot_id" });

	if (error) {
		throw new Error(`Supabase current-state upsert failed: ${error.message}`);
	}

	return { skipped: false, count: rows.length };
}

async function fetchRackTwinCurrentState() {
	if (!enabled) return [];

	const { data, error } = await supabase
		.from(CURRENT_STATE_TABLE)
		.select("*")
		.order("rack_id", { ascending: true })
		.order("slot_id", { ascending: true });

	if (error) {
		throw new Error(`Supabase current-state fetch failed: ${error.message}`);
	}

	return data || [];
}
*/

module.exports = {
	isSupabaseEnabled,
	pushTelemetryBatch,
	upsertRackCurrentState,
	fetchRackTwinCurrentState,
};
