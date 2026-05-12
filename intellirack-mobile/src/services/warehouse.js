import { API_BASE } from "../config";
import { fetchWithAuth } from "../lib/auth";

export async function fetchWarehouseOverview() {
	const res = await fetchWithAuth(`${API_BASE}/warehouse/overview`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!res.ok) {
		throw new Error("Failed to load warehouse overview");
	}

	return res.json();
}

export async function fetchWarehouseBilling() {
	const res = await fetchWithAuth(`${API_BASE}/warehouse/billing`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!res.ok) {
		throw new Error("Failed to load warehouse billing");
	}

	return res.json();
}