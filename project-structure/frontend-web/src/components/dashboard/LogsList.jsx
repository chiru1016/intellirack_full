import React, { useState, useMemo } from "react";

export default function LogsList({ logs }) {
	const [filter, setFilter] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("newest");
	const [limit, setLimit] = useState(50);

	const filteredLogs = useMemo(() => {
		let filtered = logs;

		// Filter by device/ingredient
		if (searchTerm) {
			filtered = filtered.filter(
				(log) =>
					log.ingredient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					log.device?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					log.tagUID?.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Filter by status
		if (filter !== "all") {
			filtered = filtered.filter((log) => log.status === filter);
		}

		// Sort logs
		filtered.sort((a, b) => {
			const dateA = new Date(a.timestamp);
			const dateB = new Date(b.timestamp);

			if (sortBy === "newest") {
				return dateB - dateA;
			} else if (sortBy === "oldest") {
				return dateA - dateB;
			} else if (sortBy === "weight") {
				return (b.weight || 0) - (a.weight || 0);
			}
			return 0;
		});

		return filtered.slice(0, limit);
	}, [logs, filter, searchTerm, sortBy, limit]);

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

	const getStatusColor = (status) => {
		switch (status) {
			case "GOOD":
				return "text-green-400";
			case "OK":
				return "text-yellow-400";
			case "LOW":
				return "text-orange-400";
			case "VLOW":
				return "text-red-400";
			case "EMPTY":
				return "text-gray-400";
			default:
				return "text-gray-300";
		}
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

	const exportLogs = () => {
		const csvContent = [
			"Timestamp,Device,Ingredient,Weight,Status,Tag UID",
			...filteredLogs.map(
				(log) =>
					`${new Date(log.timestamp).toISOString()},"${
						log.device?.name || "Unknown"
					}","${log.ingredient || "Unknown"}",${log.weight || 0},"${
						log.status || "Unknown"
					}","${log.tagUID || ""}"`
			),
		].join("\n");

		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `intellirack-logs-${
			new Date().toISOString().split("T")[0]
		}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-8 animate-fadein">
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-lg font-semibold text-[var(--primary)]">
					Activity Logs
				</h3>
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="Search logs..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-400"
					/>
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value="all">All Status</option>
						<option value="GOOD">Good</option>
						<option value="OK">OK</option>
						<option value="LOW">Low</option>
						<option value="VLOW">Very Low</option>
						<option value="EMPTY">Empty</option>
					</select>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value="newest">Newest First</option>
						<option value="oldest">Oldest First</option>
						<option value="weight">By Weight</option>
					</select>
					<select
						value={limit}
						onChange={(e) => setLimit(parseInt(e.target.value))}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value={25}>25 items</option>
						<option value={50}>50 items</option>
						<option value={100}>100 items</option>
						<option value={500}>500 items</option>
					</select>
				</div>
			</div>

			{/* Log Statistics */}
			<div className="grid grid-cols-5 gap-4 mb-6">
				<div className="bg-white/10 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-indigo-500">
						{filteredLogs.length}
					</div>
					<div className="text-xs text-gray-400">Total Logs</div>
				</div>
				<div className="bg-white/10 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-green-500">
						{filteredLogs.filter((log) => log.status === "GOOD").length}
					</div>
					<div className="text-xs text-gray-400">Good Stock</div>
				</div>
				<div className="bg-white/10 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-yellow-500">
						{
							filteredLogs.filter(
								(log) => log.status === "LOW" || log.status === "VLOW"
							).length
						}
					</div>
					<div className="text-xs text-gray-400">Low Stock</div>
				</div>
				<div className="bg-white/10 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-red-500">
						{filteredLogs.filter((log) => log.status === "EMPTY").length}
					</div>
					<div className="text-xs text-gray-400">Empty</div>
				</div>
				<div className="bg-white/10 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-purple-500">
						{filteredLogs
							.reduce((sum, log) => sum + (log.weight || 0), 0)
							.toFixed(0)}
						g
					</div>
					<div className="text-xs text-gray-400">Total Weight</div>
				</div>
			</div>

			{/* Logs Table */}
			<div className="bg-white/10 rounded-xl p-4">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-white/20">
								<th className="text-left py-2 text-gray-300">Time</th>
								<th className="text-left py-2 text-gray-300">Device</th>
								<th className="text-left py-2 text-gray-300">Ingredient</th>
								<th className="text-left py-2 text-gray-300">Weight</th>
								<th className="text-left py-2 text-gray-300">Status</th>
								<th className="text-left py-2 text-gray-300">Tag UID</th>
							</tr>
						</thead>
						<tbody>
							{filteredLogs.length === 0 ? (
								<tr>
									<td colSpan="6" className="text-center py-8 text-gray-400">
										<div className="text-4xl mb-2">📊</div>
										<p>No logs to show</p>
										<p className="text-sm">
											Logs will appear here as devices report data
										</p>
									</td>
								</tr>
							) : (
								filteredLogs.map((log, index) => (
									<tr
										key={log._id || index}
										className="border-b border-white/10 hover:bg-white/5"
									>
										<td className="py-2 text-gray-400">
											{formatTime(log.timestamp)}
										</td>
										<td className="py-2 text-white">
											{log.device?.name || "Unknown"}
										</td>
										<td className="py-2 text-white">
											{log.ingredient || "Unknown"}
										</td>
										<td className="py-2 text-white">
											{log.weight ? `${log.weight.toFixed(1)}g` : "N/A"}
										</td>
										<td className="py-2">
											<div className="flex items-center gap-2">
												<span className="text-sm">
													{getStatusIcon(log.status)}
												</span>
												<span
													className={`text-sm ${getStatusColor(log.status)}`}
												>
													{log.status || "Unknown"}
												</span>
											</div>
										</td>
										<td className="py-2 text-gray-400 font-mono text-xs">
											{log.tagUID ? log.tagUID.substring(0, 8) + "..." : "N/A"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="mt-6 flex gap-4 pt-6 border-t border-white/10">
				<button
					onClick={exportLogs}
					className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
				>
					Export CSV
				</button>
				<button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
					View All Logs
				</button>
				<button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
					Generate Report
				</button>
			</div>
		</div>
	);
}
