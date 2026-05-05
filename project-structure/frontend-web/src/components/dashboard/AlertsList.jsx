import React, { useState, useEffect, useMemo } from "react";
import { API_URL } from "@/lib/auth";

const API_BASE = API_URL;

export default function AlertsList({ alerts: propAlerts, onAlertModified }) {
	const [alerts, setAlerts] = useState([]);
	const [stats, setStats] = useState(null);
	const [filter, setFilter] = useState("all");
	const [sortBy, setSortBy] = useState("newest");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	// Use props if available, otherwise use local state
	const currentAlerts = propAlerts || alerts;

	const fetchAlerts = async () => {
		setLoading(true);
		setError("");
		try {
			const token = localStorage.getItem("token");

			// Build query parameters properly
			const params = new URLSearchParams();
			if (filter !== "all") {
				params.append("status", filter);
			}
			if (sortBy) {
				params.append("sort", sortBy);
			}
			params.append("limit", "25");

			const queryString = params.toString();
			const url = queryString
				? `${API_BASE}/alerts?${queryString}`
				: `${API_BASE}/alerts?limit=25`;

			console.log("AlertsList - Fetching from URL:", url);

			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to fetch alerts");
			const data = await res.json();
			// Handle both new paginated format and old array format
			const alertsData = data.alerts || data;
			setAlerts(alertsData);

			// If we're using props, also update the local state for operations
			if (propAlerts) {
				// This ensures we have fresh data for operations
				console.log(
					"AlertsList - Fetched fresh data for operations:",
					alertsData.length,
					"alerts"
				);
				// Debug: Log the first few alert IDs from backend
				console.log(
					"AlertsList - Backend alert IDs:",
					alertsData.slice(0, 3).map((a) => a._id)
				);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const fetchStats = async () => {
		try {
			const token = localStorage.getItem("token");
			const res = await fetch(`${API_BASE}/alerts/stats`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to fetch stats");
			const data = await res.json();
			setStats(data);
		} catch {}
	};

	useEffect(() => {
		// Always fetch stats and set loading to false if props are provided
		if (propAlerts) {
			setLoading(false);
			fetchStats();
		} else {
			// Only fetch alerts if no props are provided
			fetchAlerts();
			fetchStats();
		}
		// eslint-disable-next-line
	}, [propAlerts]);

	// Handle props changes - when parent updates alerts, refresh local state for operations
	useEffect(() => {
		if (propAlerts && propAlerts.length > 0) {
			// Update local state with props data for operations
			setAlerts(propAlerts);
			console.log(
				"AlertsList - Props updated, syncing local state:",
				propAlerts.length,
				"alerts"
			);
			// Debug: Log the first few alert IDs from props
			console.log(
				"AlertsList - Props alert IDs:",
				propAlerts.slice(0, 3).map((a) => a._id)
			);
		}
	}, [propAlerts]);

	// Fetch alerts when filter or sort changes (only if not using props)
	useEffect(() => {
		if (!propAlerts) {
			fetchAlerts();
		}
	}, [filter, sortBy, propAlerts]);

	const acknowledgeAlert = async (alertId) => {
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");

			// Use props data directly if available, otherwise fetch fresh data
			const currentData = propAlerts || alerts;

			// Validate that the alert ID exists in the current data
			const alertExists = currentData.find((alert) => alert._id === alertId);
			if (!alertExists) {
				console.warn(`AlertsList - Alert ${alertId} not found in current data`);
				// If using props, notify parent to refresh
				if (propAlerts) {
					// Try to refresh parent data instead of reloading
					console.log("AlertsList - Requesting parent to refresh data");
					// For now, just show an error - the parent should handle refresh
					throw new Error("Alert not found - data may be stale");
				}
				throw new Error("Alert not found");
			}

			console.log(
				`AlertsList - Acknowledging alert ${alertId} (${alertExists.ingredient})`
			);

			const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to acknowledge alert");

			// If using props, let parent handle refresh
			// If not using props, refresh local data
			if (!propAlerts) {
				await fetchAlerts();
				await fetchStats();
			} else if (onAlertModified) {
				// Notify parent to refresh data
				onAlertModified();
			}
		} catch (err) {
			console.error("AlertsList - Error acknowledging alert:", err);
			alert("Failed to acknowledge alert: " + err.message);
		} finally {
			setActionLoading(false);
		}
	};

	const acknowledgeAll = async () => {
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");

			// Always fetch fresh data to ensure we have current data
			await fetchAlerts();

			const res = await fetch(`${API_BASE}/alerts/acknowledge-all`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to acknowledge all alerts");

			// Refresh data after successful acknowledgment
			await fetchAlerts();
			await fetchStats();
		} catch (err) {
			alert("Failed to acknowledge all alerts: " + err.message);
		} finally {
			setActionLoading(false);
		}
	};

	const deleteAlert = async (alertId) => {
		if (!window.confirm("Delete this alert?")) return;
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");

			// Use props data directly if available, otherwise fetch fresh data
			const currentData = propAlerts || alerts;

			// Validate that the alert ID exists in the current data
			const alertExists = currentData.find((alert) => alert._id === alertId);
			if (!alertExists) {
				console.warn(`AlertsList - Alert ${alertId} not found in current data`);
				// If using props, notify parent to refresh
				if (propAlerts) {
					// Try to refresh parent data instead of reloading
					console.log("AlertsList - Requesting parent to refresh data");
					// For now, just show an error - the parent should handle refresh
					throw new Error("Alert not found - data may be stale");
				}
				throw new Error("Alert not found");
			}

			console.log(
				`AlertsList - Deleting alert ${alertId} (${alertExists.ingredient})`
			);

			const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to delete alert");

			// If using props, let parent handle refresh
			// If not using props, refresh local data
			if (!propAlerts) {
				await fetchAlerts();
				await fetchStats();
			} else if (onAlertModified) {
				// Notify parent to refresh data
				onAlertModified();
			}
		} catch (err) {
			console.error("AlertsList - Error deleting alert:", err);
			alert("Failed to delete alert: " + err.message);
		} finally {
			setActionLoading(false);
		}
	};

	const clearAcknowledged = async () => {
		if (!window.confirm("Delete all acknowledged alerts?")) return;
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");

			// Always fetch fresh data to ensure we have current data
			await fetchAlerts();

			const res = await fetch(`${API_BASE}/alerts/clearacknowledged`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed to clear acknowledged alerts");

			// Refresh data after successful deletion
			await fetchAlerts();
			await fetchStats();
		} catch (err) {
			alert("Failed to clear acknowledged alerts: " + err.message);
		} finally {
			setActionLoading(false);
		}
	};

	const exportAlerts = () => {
		const dataStr =
			"data:text/json;charset=utf-8," +
			encodeURIComponent(JSON.stringify(alerts, null, 2));
		const dlAnchor = document.createElement("a");
		dlAnchor.setAttribute("href", dataStr);
		dlAnchor.setAttribute("download", "alerts.json");
		dlAnchor.click();
	};

	const formatTime = (timestamp) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now - date;
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	};

	const getAlertIcon = (type) => {
		switch (type) {
			case "EMPTY":
				return "🔴";
			case "LOW_STOCK":
				return "🟠";
			case "OVERWEIGHT":
				return "🟡";
			case "DEPLETION":
				return "⚠️";
			case "RESTOCK":
				return "🔄";
			case "BATCH_USAGE":
				return "🍳";
			case "SENSOR_ERROR":
				return "❗";
			case "OFFLINE":
				return "📴";
			case "ONLINE":
				return "📶";
			case "ANOMALY":
				return "🚨";
			default:
				return "ℹ️";
		}
	};

	const getAlertColor = (type) => {
		switch (type) {
			case "EMPTY":
				return "border-red-400 bg-red-100/40";
			case "LOW_STOCK":
				return "border-yellow-400 bg-yellow-100/40";
			case "OVERWEIGHT":
				return "border-orange-400 bg-orange-100/40";
			case "DEPLETION":
				return "border-pink-400 bg-pink-100/40";
			case "RESTOCK":
				return "border-blue-400 bg-blue-100/40";
			case "BATCH_USAGE":
				return "border-purple-400 bg-purple-100/40";
			case "SENSOR_ERROR":
				return "border-gray-400 bg-gray-100/40";
			case "OFFLINE":
				return "border-gray-400 bg-gray-100/40";
			case "ONLINE":
				return "border-green-400 bg-green-100/40";
			case "ANOMALY":
				return "border-pink-400 bg-pink-100/40";
			default:
				return "border-blue-400 bg-blue-100/40";
		}
	};

	const getAlertPriority = (type) => {
		switch (type) {
			case "EMPTY":
				return "High";
			case "LOW_STOCK":
				return "Medium";
			case "OVERWEIGHT":
				return "Low";
			case "DEPLETION":
				return "High";
			case "ANOMALY":
				return "High";
			default:
				return "Info";
		}
	};

	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-8 animate-fadein">
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-lg font-semibold text-[var(--primary)]">
					Alerts & Notifications
				</h3>
				<div className="flex gap-2">
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
						disabled={actionLoading}
					>
						<option value="all">All Alerts</option>
						<option value="active">Active Only</option>
						<option value="acknowledged">Acknowledged</option>
					</select>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
						disabled={actionLoading}
					>
						<option value="newest">Newest First</option>
						<option value="oldest">Oldest First</option>
						<option value="priority">By Priority</option>
					</select>
				</div>
			</div>

			{stats && (
				<div className="grid grid-cols-4 gap-4 mb-6">
					<div className="bg-white/30 rounded-lg p-3 text-center">
						<div className="text-2xl font-bold text-red-500">{stats.empty}</div>
						<div className="text-xs text-gray-400">Empty Slots</div>
					</div>
					<div className="bg-white/30 rounded-lg p-3 text-center">
						<div className="text-2xl font-bold text-yellow-500">
							{stats.lowStock}
						</div>
						<div className="text-xs text-gray-400">Low Stock</div>
					</div>
					<div className="bg-white/30 rounded-lg p-3 text-center">
						<div className="text-2xl font-bold text-orange-500">
							{stats.overweight}
						</div>
						<div className="text-xs text-gray-400">Overweight</div>
					</div>
					<div className="bg-white/30 rounded-lg p-3 text-center">
						<div className="text-2xl font-bold text-green-500">
							{stats.acknowledged}
						</div>
						<div className="text-xs text-gray-400">Acknowledged</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className="text-center py-8 text-gray-400">Loading alerts...</div>
			) : error ? (
				<div className="text-center py-8 text-red-400">{error}</div>
			) : (
				<>
					{/* Alerts List */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
						{!currentAlerts || currentAlerts.length === 0 ? (
							<div className="col-span-full text-center py-8 text-gray-400">
								<p>No alerts to show</p>
								<p className="text-sm">
									Alerts will appear here when devices detect issues
								</p>
							</div>
						) : Array.isArray(currentAlerts) ? (
							currentAlerts.map((alert, index) => (
								<div
									key={alert._id || index}
									className={`rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2 px-4 py-2 bg-white/70 dark:bg-zinc-900/30 transition-all ${
										alert.acknowledged ? "opacity-60" : ""
									}`}
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2">
												<h4 className="font-semibold text-gray-900 dark:text-white text-base">
													{alert.ingredient || "Unknown Ingredient"}
												</h4>
												<span
													className={`px-2 py-0.5 rounded-full text-xs border border-gray-300 bg-white/60 text-gray-700 dark:bg-zinc-800/60 dark:text-gray-200`}
												>
													{getAlertPriority(alert.type)} Priority
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-xs text-gray-400">
													{formatTime(alert.createdAt)}
												</span>
												{alert.acknowledged && (
													<span className="text-xs text-green-500">✓</span>
												)}
											</div>
										</div>
										<div className="text-xs text-gray-500 mb-1">
											{alert.type === "EMPTY" && "Slot is completely empty"}
											{alert.type === "LOW_STOCK" &&
												"Stock level is below threshold"}
											{alert.type === "OVERWEIGHT" &&
												"Weight exceeds maximum limit"}
											{alert.type === "DEPLETION" &&
												"Ingredient is predicted to run out soon"}
											{alert.type === "RESTOCK" && "Ingredient restocked"}
											{alert.type === "BATCH_USAGE" &&
												"Large batch usage detected"}
											{alert.type === "SENSOR_ERROR" &&
												"Sensor error or impossible value"}
											{alert.type === "OFFLINE" && "Device is offline"}
											{alert.type === "ONLINE" && "Device is online"}
											{alert.type === "ANOMALY" && "Anomaly detected in usage"}
										</div>
										<div className="flex items-center gap-4 text-xs text-gray-400">
											<span>
												Device:{" "}
												{typeof alert.device === "string"
													? alert.device
													: alert.device && typeof alert.device === "object"
													? alert.device.name ||
													  alert.device.rackId ||
													  "Unknown"
													: "Unknown"}
											</span>
											<span>Slot: {alert.slotId || "Unknown"}</span>
											{alert.weight && <span>Weight: {alert.weight}g</span>}
										</div>
									</div>
									<div className="flex flex-row gap-2 items-end justify-end mt-2">
										{!alert.acknowledged && (
											<button
												onClick={() => acknowledgeAlert(alert._id)}
												className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs mb-1"
												disabled={actionLoading}
											>
												Acknowledge
											</button>
										)}
										<button
											onClick={() => deleteAlert(alert._id)}
											className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs mb-1"
											disabled={actionLoading}
										>
											Delete
										</button>
									</div>
								</div>
							))
						) : (
							<div className="col-span-full text-center py-8 text-red-400">
								<p>Invalid alerts data format</p>
								<p className="text-sm">Please refresh the page</p>
							</div>
						)}
					</div>
					{/* Quick Actions */}
					<div className="mt-6 flex gap-4 pt-6 border-t border-white/10 justify-center">
						<button
							onClick={acknowledgeAll}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
							disabled={actionLoading}
						>
							Acknowledge All
						</button>
						<button
							onClick={clearAcknowledged}
							className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
							disabled={actionLoading}
						>
							Clear Acknowledged
						</button>
						<button
							onClick={exportAlerts}
							className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
						>
							Export Alerts
						</button>
					</div>
				</>
			)}
		</div>
	);
}
