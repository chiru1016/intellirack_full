import React, { useState, useEffect } from "react";
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
	LineChart,
	Line,
	Legend,
	AreaChart,
	Area,
} from "recharts";

const COLORS = [
	"#6366f1",
	"#a21caf",
	"#f472b6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
];

export default function ChartsWidget({ devices, logs, liveStatus }) {
	const [activeTab, setActiveTab] = useState("usage");
	const [timeRange, setTimeRange] = useState("7d");

	// Generate mock data based on real data
	const generateUsageData = () => {
		const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
		const data = [];
		const now = new Date();

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			data.push({
				date: date.toLocaleDateString(),
				usage: Math.floor(Math.random() * 2000) + 500,
				alerts: Math.floor(Math.random() * 5),
				devices: devices.length,
			});
		}
		return data;
	};

	const generateIngredientData = () => {
		const ingredients = ["Rice", "Flour", "Sugar", "Salt", "Spices", "Other"];
		return ingredients.map((ingredient, index) => ({
			name: ingredient,
			value: Math.floor(Math.random() * 1000) + 100,
			color: COLORS[index % COLORS.length],
		}));
	};

	const generateDeviceHealthData = () => {
		return devices.map((device, index) => ({
			name:
				typeof device.name === "string"
					? device.name
					: device.rackId || "Unknown Device",
			uptime: Math.floor(Math.random() * 100),
			weight: device.lastWeight || 0,
			status: device.isOnline ? "Online" : "Offline",
		}));
	};

	const generateStockLevelsData = () => {
		const levels = ["Empty", "Very Low", "Low", "Moderate", "Good", "Max"];
		return levels.map((level, index) => ({
			level,
			count: Math.floor(Math.random() * 10) + 1,
			color: COLORS[index % COLORS.length],
		}));
	};

	const usageData = generateUsageData();
	const ingredientData = generateIngredientData();
	const deviceHealthData = generateDeviceHealthData();
	const stockLevelsData = generateStockLevelsData();

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
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-lg font-semibold text-[var(--primary)]">
					Analytics & Insights
				</h3>
				<div className="flex gap-2">
					<select
						value={timeRange}
						onChange={(e) => setTimeRange(e.target.value)}
						className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm"
					>
						<option value="7d">Last 7 days</option>
						<option value="30d">Last 30 days</option>
						<option value="90d">Last 90 days</option>
					</select>
				</div>
			</div>

			{/* Tab Navigation */}
			<div className="flex gap-4 mb-6 border-b border-white/10">
				{["usage", "ingredients", "health", "stock"].map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={`px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === tab
								? "text-white border-b-2 border-indigo-500"
								: "text-gray-400 hover:text-white"
						}`}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			{/* Charts Content */}
			<div className="h-80">
				{activeTab === "usage" && (
					<div className="space-y-6">
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={usageData}>
									<XAxis dataKey="date" />
									<YAxis />
									<Tooltip content={<CustomTooltip />} />
									<Area
										type="monotone"
										dataKey="usage"
										stroke="#6366f1"
										fill="#6366f1"
										fillOpacity={0.3}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
						<div className="grid grid-cols-3 gap-4 text-center">
							<div className="bg-white/10 rounded-lg p-3">
								<div className="text-2xl font-bold text-indigo-500">
									{usageData
										.reduce((sum, d) => sum + d.usage, 0)
										.toLocaleString()}
								</div>
								<div className="text-sm text-gray-400">Total Usage (g)</div>
							</div>
							<div className="bg-white/10 rounded-lg p-3">
								<div className="text-2xl font-bold text-purple-500">
									{usageData.reduce((sum, d) => sum + d.alerts, 0)}
								</div>
								<div className="text-sm text-gray-400">Total Alerts</div>
							</div>
							<div className="bg-white/10 rounded-lg p-3">
								<div className="text-2xl font-bold text-pink-500">
									{devices.length}
								</div>
								<div className="text-sm text-gray-400">Active Devices</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === "ingredients" && (
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={ingredientData}
									cx="50%"
									cy="50%"
									labelLine={false}
									label={({ name, percent }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
									outerRadius={80}
									fill="#8884d8"
									dataKey="value"
								>
									{ingredientData.map((entry, index) => (
										<Cell key={`cell-${index}`} fill={entry.color} />
									))}
								</Pie>
								<Tooltip content={<CustomTooltip />} />
							</PieChart>
						</ResponsiveContainer>
					</div>
				)}

				{activeTab === "health" && (
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={deviceHealthData}>
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip content={<CustomTooltip />} />
								<Bar dataKey="uptime" fill="#10b981" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				)}

				{activeTab === "stock" && (
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stockLevelsData}>
								<XAxis dataKey="level" />
								<YAxis />
								<Tooltip content={<CustomTooltip />} />
								<Bar dataKey="count" fill="#f59e0b" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				)}
			</div>
		</div>
	);
}
