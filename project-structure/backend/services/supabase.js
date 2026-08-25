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
	if (!enabled) {
		return [];
	}

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

module.exports = {
	isSupabaseEnabled,
	pushTelemetryBatch,
	upsertRackCurrentState,
	fetchRackTwinCurrentState,
};
