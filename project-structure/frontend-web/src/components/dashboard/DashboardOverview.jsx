import React, { useEffect, useState } from "react";
import StatusDot from "@/components/StatusDot";
import { API_URL } from "@/lib/auth";

const API_BASE = API_URL;

function Card({ title, children, className = "" }) {
	return (
		<div
			className={`rounded-3xl bg-white/40 dark:bg-slate-700/40 backdrop-blur-lg border border-white/20 dark:border-slate-700/50 shadow-2xl p-6 flex flex-col gap-2 ${className}`}
		>
			{title && (
				<h4 className="font-bold text-lg text-indigo-700 dark:text-indigo-200 mb-2">{title}</h4>
			)}
			{children}
		</div>
	);
}

export default function DashboardOverview({
	onAddDevice,
	onAddIngredient,
	devices: propDevices,
	alerts: propAlerts,
	logs: propLogs,
	ingredients: propIngredients,
	onAlertAcknowledged,
}) {
	const [stats, setStats] = useState({
		devices: 0,
		online: 0,
		offline: 0,
		alerts: 0,
	});
	const [devices, setDevices] = useState([]);
	const [ingredients, setIngredients] = useState([]); // [{name, weight, status, lastUpdated, device}]
	const [alerts, setAlerts] = useState([]);
	const [recent, setRecent] = useState([]);
	const [notifications, setNotifications] = useState([
		{
			id: 1,
			message: "Firmware v2.1 available for all devices!",
			date: "2025-07-21",
		},
		{
			id: 2,
			message: "New analytics: Inventory health and restock suggestions.",
			date: "2025-07-20",
		},
	]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);

	// Use props when available, fallback to local state
	const currentDevices = propDevices || devices;
	const currentAlerts = propAlerts || alerts;
	const currentLogs = propLogs || logs;
	const currentIngredients = propIngredients || ingredients;

	useEffect(() => {
		const fetchAll = async () => {
			setLoading(true);
			const token = localStorage.getItem("token");
			const fetchOptions = { headers: { Authorization: `Bearer ${token}` } };

			try {
				// Use props if available, otherwise fetch
				if (!propDevices) {
					const devicesRes = await fetch(
						`${API_BASE}/devices/my`,
						fetchOptions
					);
					setDevices(devicesRes.ok ? await devicesRes.json() : []);
				}

				if (!propAlerts) {
					const alertsRes = await fetch(
						`${API_BASE}/alerts?status=active&limit=5`,
						fetchOptions
					);
					const alertsResponse = alertsRes.ok ? await alertsRes.json() : {};
					setAlerts(alertsResponse.alerts || alertsResponse); // Handle both new and old format
				}

				if (!propLogs) {
					const logsRes = await fetch(
						`${API_BASE}/logs?limit=3&sort=newest`,
						fetchOptions
					);
					const logsResponse = logsRes.ok ? await logsRes.json() : {};
					setRecent(logsResponse.logs || logsResponse); // Handle both new and old format
				}

				// Only fetch ingredients data if not provided via props
				if (!propDevices && !propAlerts && !propLogs) {
					// Ingredients (get unique + summary)
					const uniqueRes = await fetch(
						`${API_BASE}/ingredients/unique`,
						fetchOptions
					);
					const uniqueIngredients = uniqueRes.ok ? await uniqueRes.json() : [];

					// For each ingredient, get latest log (for weight/status/prediction)
					const ingredientCards = await Promise.all(
						uniqueIngredients.map(async (name) => {
							const logRes = await fetch(
								`${API_BASE}/ingredients/logs/${encodeURIComponent(name)}`,
								fetchOptions
							);
							const logs = logRes.ok ? await logRes.json() : [];
							const latest = logs[0] || {};

							// Prediction (days left)
							const predRes = await fetch(
								`${API_BASE}/ingredients/prediction/${encodeURIComponent(
									name
								)}`,
								fetchOptions
							);
							const prediction = predRes.ok ? await predRes.json() : {};

							return {
								name,
								totalWeight: latest.weight || 0,
								status: latest.status || "-",
								daysLeft: prediction.prediction ?? null,
							};
						})
					);
					setIngredients(ingredientCards);
				}

				// Stats
				setStats({
					devices: currentDevices.length,
					online: currentDevices.filter((d) => d.isOnline).length,
					offline: currentDevices.filter((d) => !d.isOnline).length,
					alerts: currentAlerts.length,
				});
			} catch (error) {
				console.error("Error fetching dashboard data:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchAll();
	}, [propDevices, propAlerts, propLogs, propIngredients]);

	// Inventory analytics
	const totalStock = currentIngredients.reduce(
		(sum, i) => sum + (i.weight || 0),
		0
	);
	const sortedByWeight = [...currentIngredients].sort(
		(a, b) => (b.weight || 0) - (a.weight || 0)
	);
	const topStocked = sortedByWeight.slice(0, 3);
	const lowStocked = sortedByWeight.slice(-3).reverse();
	const soonEmpty = currentIngredients.filter(
		(i) => i.daysLeft !== null && i.daysLeft <= 2
	);
	const restockSuggestions = lowStocked.filter((i) => i.weight < 200);
	const inventoryHealth =
		totalStock > 0
			? Math.min(
					100,
					Math.round((totalStock / (currentIngredients.length * 1000)) * 100)
			  )
			: 0; // Assume 1000g max per ingredient

	const acknowledgeAlert = async (alertId) => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`${API_BASE}/alerts/${alertId}/acknowledge`,
				{
					method: "PATCH",
					headers: { Authorization: `Bearer ${token}` },
				}
			);

			if (response.ok) {
				// Notify parent to refresh alerts data
				if (onAlertAcknowledged) {
					onAlertAcknowledged(alertId);
				}
			} else if (response.status === 404) {
				console.warn(
					`DashboardOverview - Alert ${alertId} not found (may have been deleted)`
				);
				// Alert doesn't exist, refresh data immediately
				if (onAlertAcknowledged) {
					onAlertAcknowledged(alertId);
				}
			} else {
				console.error(
					"DashboardOverview - Failed to acknowledge alert:",
					response.status
				);
			}
		} catch (error) {
			console.error("DashboardOverview - Error acknowledging alert:", error);
			// On error, also try to refresh data
			if (onAlertAcknowledged) {
				onAlertAcknowledged(alertId);
			}
		}
	};

	const acknowledgeAll = async () => {
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");
			await fetch(`${API_BASE}/alerts/acknowledge-all`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			});
			setAlerts([]);
			// Notify parent to refresh alerts data
			onAlertAcknowledged && onAlertAcknowledged("all");
		} catch (error) {
			console.error("Error acknowledging all alerts:", error);
		} finally {
			setActionLoading(false);
		}
	};

	const exportData = async () => {
		setActionLoading(true);
		try {
			const token = localStorage.getItem("token");
			const fetchOptions = { headers: { Authorization: `Bearer ${token}` } };
			const [userRes, devicesRes, ingredientsRes, logsRes] = await Promise.all([
				fetch(`${API_BASE}/user/me`, fetchOptions),
				fetch(`${API_BASE}/devices/my`, fetchOptions),
				fetch(`${API_BASE}/ingredients/unique`, fetchOptions),
				fetch(`${API_BASE}/logs`, fetchOptions),
			]);
			const user = userRes.ok ? await userRes.json() : {};
			const devices = devicesRes.ok ? await devicesRes.json() : [];
			const ingredients = ingredientsRes.ok ? await ingredientsRes.json() : [];
			const logs = logsRes.ok ? await logsRes.json() : [];
			const data = {
				user,
				devices,
				ingredients,
				logs,
				exportDate: new Date().toISOString(),
			};
			const blob = new Blob([JSON.stringify(data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `intellirack-export-${
				new Date().toISOString().split("T")[0]
			}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} finally {
			setActionLoading(false);
		}
	};

	if (loading)
		return <div className="text-center py-12">Loading dashboard...</div>;

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-8">
			{/* System Stats - Large Glassy Card */}
			<Card
				title={null}
				className="col-span-1 xl:col-span-7 p-8 flex-row items-center justify-between !gap-8"
			>
				<div className="flex flex-wrap gap-8 justify-between w-full">
					<div className="flex flex-col items-center flex-1 min-w-[120px]">
						<span className="text-5xl font-extrabold text-indigo-600 drop-shadow">
							{stats.devices}
						</span>
								<span className="text-base text-gray-500 dark:text-slate-200 mt-1">Devices</span>
					</div>
					<div className="flex flex-col items-center flex-1 min-w-[120px]">
						<span className="text-5xl font-extrabold text-green-500 drop-shadow">
							{stats.online}
						</span>
								<span className="text-base text-gray-500 dark:text-slate-200 mt-1">Online</span>
					</div>
					<div className="flex flex-col items-center flex-1 min-w-[120px]">
						<span className="text-5xl font-extrabold text-red-500 drop-shadow">
							{stats.offline}
						</span>
								<span className="text-base text-gray-500 dark:text-slate-200 mt-1">Offline</span>
					</div>
					<div className="flex flex-col items-center flex-1 min-w-[120px]">
						<span className="text-5xl font-extrabold text-pink-500 drop-shadow">
							{stats.alerts}
						</span>
								<span className="text-base text-gray-500 dark:text-slate-200 mt-1">Active Alerts</span>
					</div>
				</div>
			</Card>
			{/* Notifications/What's New Card */}
			<Card title="What's New" className="col-span-1 xl:col-span-3">
				<ul className="space-y-2">
					{notifications.map((n) => (
						<li key={n.id} className="flex items-center gap-2 text-sm">
							<span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
							<span className="font-medium text-gray-700 dark:text-gray-200">
								{n.message}
							</span>
							<span className="text-xs text-gray-400 ml-auto">{n.date}</span>
						</li>
					))}
				</ul>
			</Card>
			{/* Inventory Overview Card */}
			<Card title="Inventory Overview" className="col-span-1 xl:col-span-10">
				<div className="mb-2 flex flex-wrap gap-4 items-center">
					<span className="text-xs text-gray-500">Total Stock</span>
					<span className="ml-2 font-bold text-indigo-700 text-lg">
						{totalStock.toFixed(1)}g
					</span>
					<span className="text-xs text-gray-500 ml-6">Inventory Health</span>
					<div className="w-32 h-3 bg-gray-200 rounded-full mt-1 mx-2">
						<div
							className="h-3 rounded-full bg-gradient-to-r from-green-400 to-pink-400"
							style={{ width: `${inventoryHealth}%` }}
						></div>
					</div>
					<span className="text-xs text-gray-400">{inventoryHealth}%</span>
				</div>
				<div className="mb-2 flex flex-wrap gap-4">
					<span className="text-xs text-gray-500">Top Stocked</span>
					{topStocked.map((i) => (
						<span
							key={i.name}
							className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium"
						>
							{i.name}: {i.weight}g
						</span>
					))}
					<span className="text-xs text-gray-500 ml-6">Least Stocked</span>
					{lowStocked.map((i) => (
						<span
							key={i.name}
							className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium"
						>
							{i.name}: {i.weight}g
						</span>
					))}
				</div>
				<div className="mb-2 flex flex-wrap gap-4">
					<span className="text-xs text-gray-500">Soon to be Empty</span>
					{soonEmpty.length === 0 ? (
						<span className="text-xs text-gray-400">None</span>
					) : (
						soonEmpty.map((i) => (
							<span
								key={i.name}
								className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium"
							>
								{i.name} ({i.weight}g)
							</span>
						))
					)}
				</div>
				<div className="mb-2 flex flex-wrap gap-4">
					<span className="text-xs text-gray-500">Restock Suggestions</span>
					{restockSuggestions.length === 0 ? (
						<span className="text-xs text-gray-400">None</span>
					) : (
						restockSuggestions.map((i) => (
							<span
								key={i.name}
								className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium"
							>
								{i.name}
							</span>
						))
					)}
				</div>
			</Card>
			{/* Recent Activity Card */}
			<Card
				title="Recent Activity"
				className="col-span-1 xl:col-span-5 flex flex-col"
			>
				{(() => {
					return currentLogs && currentLogs.length > 0 ? (
						<ul className="divide-y divide-gray-200 dark:divide-zinc-800">
							{currentLogs.map((log) => (
								<li key={log._id} className="py-2 flex items-center gap-2">
									<StatusDot status={log.status} />
									<span className="font-medium text-gray-800 dark:text-gray-200">
										{log.ingredient}
									</span>
									<span className="text-xs text-gray-400">{log.status}</span>
									<span className="text-xs text-gray-400">{log.weight}g</span>
									<span className="text-xs text-gray-400">
										{log.device?.name || log.device?.rackId}
									</span>
									<span className="text-xs text-gray-400 ml-auto">
										{log.timestamp
											? new Date(log.timestamp).toLocaleString()
											: "-"}
									</span>
								</li>
							))}
						</ul>
					) : (
						<div className="text-center py-4 text-gray-500">
							No recent activity
						</div>
					);
				})()}
			</Card>
			{/* Active Alerts Card */}
			<Card
				title="Active Alerts"
				className="col-span-1 xl:col-span-5 flex flex-col"
			>
				{(() => {
					return currentAlerts && currentAlerts.length > 0 ? (
						<ul className="divide-y divide-gray-200 dark:divide-zinc-800">
							{currentAlerts.slice(0, 5).map((alert) => (
								<li key={alert._id} className="py-2 flex items-center gap-2">
									<StatusDot status={alert.type} />
									<span className="font-medium text-gray-800 dark:text-gray-200">
										{alert.ingredient}
									</span>
									<span className="text-xs text-gray-400">{alert.type}</span>
									<span className="text-xs text-gray-400">
										{alert.device?.name || alert.device?.rackId}
									</span>
									<span className="text-xs text-gray-400 ml-auto">
										{alert.createdAt
											? new Date(alert.createdAt).toLocaleString()
											: "-"}
									</span>
									<button
										onClick={() => acknowledgeAlert(alert._id)}
										className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs ml-2"
									>
										Ack
									</button>
								</li>
							))}
							{currentAlerts.length > 5 && (
								<li className="py-2 text-center text-xs text-gray-500">
									Showing 5 of {currentAlerts.length} alerts
								</li>
							)}
						</ul>
					) : (
						<div className="text-center py-4 text-gray-500">
							No active alerts
						</div>
					);
				})()}
			</Card>
			{/* Quick Actions Card */}
			<Card title="Quick Actions" className="col-span-full">
				<div className="flex flex-wrap gap-3">
					<button
						className="px-4 py-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-lg font-semibold shadow"
						onClick={onAddDevice}
						disabled={actionLoading}
					>
						Add Device
					</button>
					<button
						className="px-4 py-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white rounded-lg font-semibold shadow"
						onClick={onAddIngredient}
						disabled={actionLoading}
					>
						Add Ingredient
					</button>
					<button
						className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-semibold shadow"
						onClick={exportData}
						disabled={actionLoading}
					>
						{actionLoading ? "Exporting..." : "Export Data"}
					</button>
					<button
						className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold shadow"
						onClick={acknowledgeAll}
						disabled={actionLoading}
					>
						{actionLoading ? "Acknowledging..." : "Acknowledge All"}
					</button>
				</div>
				{/* Device/Ingredient Quick Actions */}
				<div className="mt-4 flex flex-wrap gap-2">
					{currentDevices.slice(0, 3).map((d) => (
						<button
							key={d._id}
							className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium shadow"
						>
							{d.name}: Settings
						</button>
					))}
					{currentIngredients.slice(0, 3).map((i) => (
						<button
							key={i.name}
							className="px-3 py-1 bg-pink-100 text-pink-700 rounded text-xs font-medium shadow"
						>
							{i.name}: Details
						</button>
					))}
				</div>
			</Card>
		</div>
	);
}
