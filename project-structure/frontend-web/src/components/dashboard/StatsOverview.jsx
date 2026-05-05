import React, { useMemo } from "react";
import {
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

const COLORS = [
	"#6366f1",
	"#a21caf",
	"#f472b6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
];

export default function StatsOverview({ devices, alerts, logs, liveStatus }) {
	// Calculate real statistics
	const stats = useMemo(() => {
		const totalDevices = devices.length;
		const onlineDevices = devices.filter((d) => d.isOnline).length;
		const totalWeight = devices.reduce(
			(sum, d) => sum + (d.lastWeight || 0),
			0
		);
		const activeAlerts = alerts.filter((a) => !a.acknowledged).length;
		const recentLogs = logs.filter((log) => {
			const logTime = new Date(log.timestamp);
			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
			return logTime > oneDayAgo;
		}).length;

		// Calculate device health
		const deviceHealth = devices.map((device) => ({
			name:
				typeof device.name === "string"
					? device.name
					: device.rackId || "Unknown Device",
			status: device.isOnline ? "Online" : "Offline",
			weight: device.lastWeight || 0,
			lastSeen: device.lastSeen,
			uptime: device.isOnline ? 100 : 0,
		}));

		// Calculate stock levels
		const stockLevels = devices.reduce((acc, device) => {
			const weight = device.lastWeight || 0;
			const thresholds = device.weightThresholds || {
				min: 5,
				low: 100,
				moderate: 200,
				good: 500,
				max: 5000,
			};

			let level = "Empty";
			if (weight > thresholds.max) level = "Max";
			else if (weight >= thresholds.good) level = "Good";
			else if (weight >= thresholds.moderate) level = "Moderate";
			else if (weight >= thresholds.low) level = "Low";
			else if (weight >= thresholds.min) level = "Very Low";

			acc[level] = (acc[level] || 0) + 1;
			return acc;
		}, {});

		// Calculate usage trends (mock data based on logs)
		const usageTrends = [];
		const now = new Date();
		for (let i = 6; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			usageTrends.push({
				day: date.toLocaleDateString("en-US", { weekday: "short" }),
				usage: Math.floor(Math.random() * 2000) + 500,
				alerts: Math.floor(Math.random() * 5),
			});
		}

		return {
			totalDevices,
			onlineDevices,
			totalWeight,
			activeAlerts,
			recentLogs,
			deviceHealth,
			stockLevels,
			usageTrends,
		};
	}, [devices, alerts, logs, liveStatus]);

	const CustomTooltip = ({ active, payload, label }) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
					<p className="font-semibold">{label}</p>
					{payload.map((entry, index) => (
						<p key={index} style={{ color: entry.color }}>
							{entry.name}: {entry.value}
						</p>
					))}
				</div>
			);
		}
		return null;
	};

	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-8 animate-fadein">
			<h3 className="text-lg font-semibold mb-6 text-[var(--primary)]">
				Inventory Overview
			</h3>

			{/* Key Metrics */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
				<div className="bg-white/10 rounded-xl p-4 text-center">
					<div className="text-2xl font-bold text-indigo-500">
						{stats.totalDevices}
					</div>
					<div className="text-sm text-gray-400">Total Devices</div>
				</div>
				<div className="bg-white/10 rounded-xl p-4 text-center">
					<div className="text-2xl font-bold text-green-500">
						{stats.onlineDevices}
					</div>
					<div className="text-sm text-gray-400">Online</div>
				</div>
				<div className="bg-white/10 rounded-xl p-4 text-center">
					<div className="text-2xl font-bold text-purple-500">
						{stats.activeAlerts}
					</div>
					<div className="text-sm text-gray-400">Active Alerts</div>
				</div>
				<div className="bg-white/10 rounded-xl p-4 text-center">
					<div className="text-2xl font-bold text-pink-500">
						{stats.recentLogs}
					</div>
					<div className="text-sm text-gray-400">Today's Logs</div>
				</div>
				<div className="bg-white/10 rounded-xl p-4 text-center">
					<div className="text-2xl font-bold text-orange-500">
						{(stats.totalWeight / 1000).toFixed(1)}kg
					</div>
					<div className="text-sm text-gray-400">Total Weight</div>
				</div>
			</div>

			{/* Charts Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Usage Trends */}
				<div className="bg-white/10 rounded-xl p-4">
					<h4 className="text-md font-semibold text-white mb-4">
						Weekly Usage Trends
					</h4>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stats.usageTrends}>
								<XAxis dataKey="day" />
								<YAxis />
								<Tooltip content={<CustomTooltip />} />
								<Bar dataKey="usage" fill="#6366f1" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Stock Levels */}
				<div className="bg-white/10 rounded-xl p-4">
					<h4 className="text-md font-semibold text-white mb-4">
						Stock Levels
					</h4>
					<div className="h-48">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={Object.entries(stats.stockLevels).map(
										([level, count], index) => ({
											name: level,
											value: count,
											color: COLORS[index % COLORS.length],
										})
									)}
									cx="50%"
									cy="50%"
									labelLine={false}
									label={({ name, percent }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
									outerRadius={60}
									fill="#8884d8"
									dataKey="value"
								>
									{Object.entries(stats.stockLevels).map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORS[index % COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip content={<CustomTooltip />} />
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			{/* Device Status Table */}
			<div className="mt-6 bg-white/10 rounded-xl p-4">
				<h4 className="text-md font-semibold text-white mb-4">Device Status</h4>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-white/20">
								<th className="text-left py-2 text-gray-300">Device</th>
								<th className="text-left py-2 text-gray-300">Status</th>
								<th className="text-left py-2 text-gray-300">Weight</th>
								<th className="text-left py-2 text-gray-300">Last Seen</th>
							</tr>
						</thead>
						<tbody>
							{stats.deviceHealth.map((device, index) => (
								<tr key={index} className="border-b border-white/10">
									<td className="py-2 text-white">
										{typeof device.name === "string"
											? device.name
											: "Unknown Device"}
									</td>
									<td className="py-2">
										<span
											className={`px-2 py-1 rounded-full text-xs ${
												device.status === "Online"
													? "bg-green-500/20 text-green-400"
													: "bg-red-500/20 text-red-400"
											}`}
										>
											{device.status}
										</span>
									</td>
									<td className="py-2 text-white">
										{device.weight > 0 ? `${device.weight.toFixed(1)}g` : "N/A"}
									</td>
									<td className="py-2 text-gray-400">
										{device.lastSeen
											? new Date(device.lastSeen).toLocaleString()
											: "Never"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="mt-6 flex gap-4">
				<button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
					View All Devices
				</button>
				<button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
					Export Report
				</button>
				<button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
					Manage Alerts
				</button>
			</div>
		</div>
	);
}
