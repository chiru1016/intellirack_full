const express = require("express");
const { isSupabaseEnabled, fetchRackTwinCurrentState } = require("../services/supabase");
const Device = require("../models/Device");

const router = express.Router();

let supabaseMapCache = null;
let supabaseMapCacheAt = 0;
const SUPABASE_CACHE_TTL = 3000; // ms — reuse result for 3 seconds

// Build a map of rack_id → latest Supabase row (cached)
async function buildSupabaseMap() {
	if (!isSupabaseEnabled()) return {};
	const now = Date.now();
	if (supabaseMapCache && now - supabaseMapCacheAt < SUPABASE_CACHE_TTL) {
		return supabaseMapCache;
	}
	try {
		const rows = await fetchRackTwinCurrentState();
		const map = {};
		for (const row of rows) {
			const key = (row.rack_id || "").toLowerCase();
			map[key] = row;
		}
		supabaseMapCache = map;
		supabaseMapCacheAt = now;
		return map;
	} catch {
		return supabaseMapCache || {};
	}
}

// Get live weight for a specific rack by rackId
router.get("/weight/:rackId", async (req, res) => {
	try {
		const rackId = (req.params.rackId || "").toLowerCase();
		const device = await Device.findOne({ rackId: new RegExp(`^${rackId}$`, "i") }).lean();
		if (!device) return res.status(404).json({ error: "Device not found" });

		const supabaseMap = await buildSupabaseMap();
		const sb = supabaseMap[rackId] || null;

		res.json({
			rack_id: device.rackId,
			weight_grams: sb?.weight_grams ?? (typeof device.lastWeight === "number" ? device.lastWeight : 0),
			status: sb?.status ?? device.lastStatus ?? "EMPTY",
			ingredient: sb?.ingredient ?? device.ingredient ?? null,
			event_time: sb?.event_time ?? device.lastSeen ?? null,
			isOnline: device.isOnline,
		});
	} catch (error) {
		console.error("Twin weight fetch failed:", error);
		res.status(500).json({ error: "Failed to fetch weight" });
	}
});

router.get("/current", async (req, res) => {
	try {
		// MongoDB is the authoritative device list — never return more devices than exist here
		const devices = await Device.find({}).sort({ createdAt: 1 }).lean();

		if (!devices || devices.length === 0) {
			return res.json([]);
		}

		const supabaseMap = await buildSupabaseMap();

		const rows = devices.map((device) => {
			const key = (device.rackId || "").toLowerCase();
			const sb = supabaseMap[key] || null;

			return {
				rack_id: device.rackId,
				device_name: device.name || null,
				slot_id: 1,
				ingredient: sb?.ingredient ?? device.ingredient ?? null,
				weight_grams: sb?.weight_grams ?? (typeof device.lastWeight === "number" ? device.lastWeight : 0),
				status: sb?.status ?? device.lastStatus ?? "EMPTY",
				owner_id: device.owner ? String(device.owner) : null,
				event_time: sb?.event_time ?? device.lastSeen ?? null,
				mongo_device_id: String(device._id),
				metadata: {
					source: sb ? "supabase+mongo" : "mongo",
					isOnline: device.isOnline,
					temp: sb?.metadata?.temp ?? null,
					humidity: sb?.metadata?.humidity ?? null,
				},
			};
		});

		res.json(rows);
	} catch (error) {
		console.error("Twin current-state fetch failed:", error);
		res.json([]);
	}
});

module.exports = router;
