import React, { useState, useMemo } from "react";

export default function ActivityTimeline({ timeline, logs, devices }) {
	const [filter, setFilter] = useState("all");
	const [limit, setLimit] = useState(10);

	const getStatusIcon = (status) => {
		switch (status) {
			case "GOOD":
				return "🟢";
			case "OK":
				return "🟡";
			case "LOW":
				return "🟠";
			case "VLOW":
				return "🔴";
			case "EMPTY":
				return "⚫";
			default:
				return "📊";
		}
	};

	// Generate real timeline data from logs and devices
	const realTimeline = useMemo(() => {
		const activities = [];

		// Add device events
		devices.forEach((device) => {
			if (device.lastSeen) {
				const deviceName =
					typeof device.name === "string"
						? device.name
						: device.rackId || "Unknown Device";
				activities.push({
					id: `device-${device._id}`,
					time: new Date(device.lastSeen),
					event: `${deviceName}: ${device.isOnline ? "Online" : "Offline"}`,
					type: "device",
					device: deviceName,
					icon: device.isOnline ? "🟢" : "🔴",
				});
			}
		});

		// Add log events
		logs.forEach((log, index) => {
			const deviceName = log.device?.name
				? typeof log.device.name === "string"
					? log.device.name
					: log.device.rackId || "Unknown"
				: "Unknown";
			activities.push({
				id: `log-${index}`,
				time: new Date(log.timestamp),
				event: `${log.ingredient || "Unknown"}: ${log.weight}g (${log.status})`,
				type: "log",
				device: deviceName,
				icon: getStatusIcon(log.status),
			});
		});

		// Add mock timeline events if no real data
		if (activities.length === 0) {
			return [
				{ time: "09:00", event: "Device A: Added Rice", icon: "📦" },
				{ time: "10:30", event: "Device B: Low Stock Alert", icon: "⚠️" },
				{ time: "12:00", event: "Device A: Removed Flour", icon: "📤" },
				{ time: "13:45", event: "Device C: Added Sugar", icon: "📦" },
				{ time: "15:00", event: "Device B: Empty Slot", icon: "🔴" },
			];
		}

		// Sort by time (newest first)
		return activities.sort((a, b) => b.time - a.time).slice(0, limit);
	}, [timeline, logs, devices, limit]);

	const filteredTimeline = useMemo(() => {
		if (filter === "all") return realTimeline;
		return realTimeline.filter((item) => item.type === filter);
	}, [realTimeline, filter]);

	const formatTime = (time) => {
		if (typeof time === "string") return time;
		const now = new Date();
		const diff = now - time;
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return time.toLocaleDateString();
	};

	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-8 animate-fadein">
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-lg font-semibold text-[var(--primary)]">
					Activity Timeline
				</h3>
				<div className="flex gap-2">
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value="all">All Events</option>
						<option value="device">Device Events</option>
						<option value="log">Log Events</option>
					</select>
					<select
						value={limit}
						onChange={(e) => setLimit(parseInt(e.target.value))}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value={5}>5 items</option>
						<option value={10}>10 items</option>
						<option value={20}>20 items</option>
						<option value={50}>50 items</option>
					</select>
				</div>
			</div>

			<div className="space-y-4 max-h-96 overflow-y-auto">
				{filteredTimeline.length === 0 ? (
					<div className="text-center py-8 text-gray-400 dark:text-slate-300">
						<div className="text-4xl mb-2">📊</div>
						<p>No activity to show</p>
						<p className="text-sm">
							Activity will appear here as devices report data
						</p>
					</div>
				) : (
					filteredTimeline.map((item, index) => (
						<div
							key={item.id || index}
							className="flex items-start gap-4 p-4 bg-white/10 rounded-xl border border-white/20 hover:bg-white/15 transition-colors"
						>
							<div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">
								{item.icon}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between mb-1">
									<p className="text-sm font-medium text-white truncate">
										{item.event}
									</p>
									<span className="text-xs text-gray-400 dark:text-slate-300 ml-2">
										{formatTime(item.time)}
									</span>
								</div>
								{item.device && (
									<p className="text-xs text-gray-400 dark:text-slate-300">Device: {item.device}</p>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{/* Summary Stats */}
			<div className="mt-6 pt-6 border-t border-white/10">
				<div className="grid grid-cols-3 gap-4 text-center">
					<div className="bg-white/10 rounded-lg p-3">
						<div className="text-2xl font-bold text-indigo-500">
							{filteredTimeline.length}
						</div>
							<div className="text-xs text-gray-400 dark:text-slate-300">Total Events</div>
					</div>
					<div className="bg-white/10 rounded-lg p-3">
						<div className="text-2xl font-bold text-green-500">
							{
								filteredTimeline.filter(
									(item) => item.type === "device" && item.icon === "🟢"
								).length
							}
						</div>
							<div className="text-xs text-gray-400 dark:text-slate-300">Online Devices</div>
					</div>
					<div className="bg-white/10 rounded-lg p-3">
						<div className="text-2xl font-bold text-yellow-500">
							{
								filteredTimeline.filter(
									(item) => item.icon === "⚠️" || item.icon === "🔴"
								).length
							}
						</div>
							<div className="text-xs text-gray-400 dark:text-slate-300">Alerts</div>
					</div>
				</div>
			</div>
		</div>
	);
}
