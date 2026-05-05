import React, { useState, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function SettingsWidget({ user }) {
	const { setThemeMode } = useTheme();
	const [activeTab, setActiveTab] = useState("notifications");
	const [settings, setSettings] = useState({
		notifications: {
			email: true,
			push: true,
			lowStock: true,
			emptySlot: true,
			deviceOffline: true,
		},
		display: {
			theme: "auto",
			language: "en",
			timezone: "UTC",
		},
		data: {
			autoBackup: true,
			backupFrequency: "daily",
			retentionDays: 30,
		},
		alerts: {
			lowStockThreshold: 20,
			emptyThreshold: 5,
			checkInterval: 5,
		},
	});
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [expanded, setExpanded] = useState(null);

	useEffect(() => {
		// Load user settings from localStorage or API
		const savedSettings = localStorage.getItem("userSettings");
		if (savedSettings) {
			setSettings(JSON.parse(savedSettings));
		}
	}, []);

	const saveSettings = async () => {
		setIsLoading(true);
		try {
			localStorage.setItem("userSettings", JSON.stringify(settings));
			// Apply theme if it changed
			if (settings.display.theme) {
				setThemeMode(settings.display.theme);
			}
			setMessage("Settings saved successfully!");
			setTimeout(() => setMessage(""), 3000);
		} catch (error) {
			setMessage("Error saving settings");
		} finally {
			setIsLoading(false);
		}
	};

	const exportData = async () => {
		setIsLoading(true);
		try {
			// Simulate data export
			const data = {
				user: user,
				settings: settings,
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

			setMessage("Data exported successfully!");
			setTimeout(() => setMessage(""), 3000);
		} catch (error) {
			setMessage("Error exporting data");
		} finally {
			setIsLoading(false);
		}
	};

	const resetSettings = () => {
		if (confirm("Are you sure you want to reset all settings to default?")) {
			setSettings({
				notifications: {
					email: true,
					push: true,
					lowStock: true,
					emptySlot: true,
					deviceOffline: true,
				},
				display: {
					theme: "auto",
					language: "en",
					timezone: "UTC",
				},
				data: {
					autoBackup: true,
					backupFrequency: "daily",
					retentionDays: 30,
				},
				alerts: {
					lowStockThreshold: 20,
					emptyThreshold: 5,
					checkInterval: 5,
				},
			});
			setMessage("Settings reset to default");
			setTimeout(() => setMessage(""), 3000);
		}
	};

	const SECTION_LIST = [
		{ key: "user", label: "User Info" },
		{ key: "notifications", label: "Notifications" },
		{ key: "display", label: "Display" },
		{ key: "data", label: "Data & Export" },
		{ key: "alerts", label: "Alert Rules" },
		{ key: "about", label: "About" },
	];

	return (
		<div className="rounded-3xl bg-white/80 dark:bg-slate-800/40 backdrop-blur-[30px] border border-white/40 dark:border-slate-700/50 shadow-2xl p-8 animate-fadein">
			<div className="mb-6">
				<h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
					Settings & Preferences
				</h3>
				{message && (
					<div className="text-sm text-green-600 dark:text-green-400 bg-green-100/40 dark:bg-green-900/30 px-3 py-1 rounded-lg mt-2 font-semibold">
						{message}
					</div>
				)}
			</div>

			{/* Tab Navigation */}
			<div className="flex flex-wrap gap-3 mb-6 border-b border-white/10 pb-4">
				{SECTION_LIST.map((section) => (
					<button
						key={section.key}
						onClick={() =>
							setExpanded(expanded === section.key ? null : section.key)
						}
						className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 ${
							expanded === section.key
								? "bg-slate-200 text-slate-900 border-slate-100 shadow-sm"
								: "bg-slate-700/45 text-slate-100 border-slate-500/30 hover:bg-slate-600/60"
						}`}
					>
						<div className="flex items-center gap-3">
							<span className="transition-colors duration-200">
								{section.label}
							</span>
						</div>
						{/* <span className="text-indigo-400 text-xl">
								{expanded === section.key ? "▾" : "▸"}
							</span> */}
					</button>
				))}
			</div>

			{/* Settings Content */}
			<div className="space-y-6">
				{/* User Info Card (always visible) */}
				<div className="rounded-2xl bg-white/60 dark:bg-slate-700/40 backdrop-blur-lg border border-indigo-200 dark:border-indigo-900/30 shadow-sm p-6">
					<div className="flex items-center gap-3 mb-2">
						<span className="text-2xl">👤</span>
						<span className="font-semibold text-lg text-indigo-700 dark:text-indigo-200">
							{user?.name || "User"}
						</span>
					</div>
					<div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
						{user?.email}
					</div>
					<div className="text-xs text-gray-500 dark:text-gray-400">
						Account Created:{" "}
						{user?.createdAt
							? new Date(user.createdAt).toLocaleDateString()
							: "Unknown"}
					</div>
				</div>
				{/* Accordion Sections */}
				{SECTION_LIST.filter((s) => s.key !== "user").map((section) => (
					<div
						key={section.key}
						className="rounded-2xl bg-white/60 dark:bg-slate-700/40 backdrop-blur-lg border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
					>
						<button
							className="w-full flex items-center justify-between px-6 py-4 focus:outline-none group hover:bg-white/30 dark:hover:bg-slate-600/20 transition-colors"
							onClick={() =>
								setExpanded(expanded === section.key ? null : section.key)
							}
						>
							<div className="flex items-center gap-3">
								<span className="font-semibold text-base bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text transition-colors duration-200">
									{section.label}
								</span>
							</div>
							<span className="text-indigo-400 dark:text-indigo-300 text-xl">
								{expanded === section.key ? "▾" : "▸"}
							</span>
						</button>
						{expanded === section.key && (
							<div className="px-6 pb-6">
								{section.key === "notifications" && (
									<div className="space-y-4 mt-2">
										{Object.entries(settings.notifications).map(
											([key, value]) => (
												<div
													key={key}
													className="flex items-center justify-between"
												>
													<label className="text-sm font-medium text-indigo-700 dark:text-indigo-300 capitalize">
														{key.replace(/([A-Z])/g, " $1").trim()}
													</label>
													<label className="relative inline-flex items-center cursor-pointer">
														<input
															type="checkbox"
															checked={value}
															onChange={(e) =>
																setSettings((prev) => ({
																	...prev,
																	notifications: {
																		...prev.notifications,
																		[key]: e.target.checked,
																	},
																}))
															}
															className="sr-only peer"
														/>
														<div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-pink-500"></div>
													</label>
												</div>
											)
										)}
									</div>
								)}
								{section.key === "display" && (
									<div className="space-y-4 mt-2">
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Theme
											</label>
											<select
												value={settings.display.theme}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														display: { ...prev.display, theme: e.target.value },
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											>
												<option value="auto">Auto</option>
												<option value="light">Light</option>
												<option value="dark">Dark</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Language
											</label>
											<select
												value={settings.display.language}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														display: {
															...prev.display,
															language: e.target.value,
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											>
												<option value="en">English</option>
												<option value="es">Spanish</option>
												<option value="fr">French</option>
												<option value="de">German</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Timezone
											</label>
											<select
												value={settings.display.timezone}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														display: {
															...prev.display,
															timezone: e.target.value,
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											>
												<option value="UTC">UTC</option>
												<option value="EST">Eastern Time</option>
												<option value="PST">Pacific Time</option>
												<option value="GMT">GMT</option>
											</select>
										</div>
									</div>
								)}
								{section.key === "data" && (
									<div className="space-y-4 mt-2">
										<div className="flex items-center justify-between">
											<label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
												Auto Backup
											</label>
											<label className="relative inline-flex items-center cursor-pointer">
												<input
													type="checkbox"
													checked={settings.data.autoBackup}
													onChange={(e) =>
														setSettings((prev) => ({
															...prev,
															data: {
																...prev.data,
																autoBackup: e.target.checked,
															},
														}))
													}
													className="sr-only peer"
												/>
												<div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-pink-500"></div>
											</label>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Backup Frequency
											</label>
											<select
												value={settings.data.backupFrequency}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														data: {
															...prev.data,
															backupFrequency: e.target.value,
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											>
												<option value="daily">Daily</option>
												<option value="weekly">Weekly</option>
												<option value="monthly">Monthly</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Data Retention (days)
											</label>
											<input
												type="number"
												value={settings.data.retentionDays}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														data: {
															...prev.data,
															retentionDays: parseInt(e.target.value),
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											/>
										</div>
										<button
											onClick={exportData}
											disabled={isLoading}
											className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 text-white rounded-xl hover:from-indigo-600 hover:via-fuchsia-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
										>
											{isLoading ? "Exporting..." : "Export Data"}
										</button>
									</div>
								)}
								{section.key === "alerts" && (
									<div className="space-y-4 mt-2">
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Low Stock Threshold (%)
											</label>
											<input
												type="number"
												value={settings.alerts.lowStockThreshold}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														alerts: {
															...prev.alerts,
															lowStockThreshold: parseInt(e.target.value),
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											/>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Empty Threshold (g)
											</label>
											<input
												type="number"
												value={settings.alerts.emptyThreshold}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														alerts: {
															...prev.alerts,
															emptyThreshold: parseInt(e.target.value),
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											/>
										</div>
										<div>
											<label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
												Check Interval (minutes)
											</label>
											<input
												type="number"
												value={settings.alerts.checkInterval}
												onChange={(e) =>
													setSettings((prev) => ({
														...prev,
														alerts: {
															...prev.alerts,
															checkInterval: parseInt(e.target.value),
														},
													}))
												}
												className="w-full px-3 py-2 bg-white/80 border border-indigo-200 dark:bg-slate-700 dark:border-slate-600 rounded-lg text-indigo-900 dark:text-slate-100"
											/>
										</div>
									</div>
								)}
								{section.key === "about" && (
									<div className="space-y-4 mt-2">
										<ul className="list-disc pl-6 text-base text-indigo-700 dark:text-indigo-200 space-y-1">
											<li>Smart ingredient tracking and analytics</li>
											<li>Real-time device monitoring and alerts</li>
											<li>Predictive depletion and restock suggestions</li>
											<li>Batch usage and anomaly detection</li>
											<li>Personalized recommendations and substitutions</li>
											<li>Data export and privacy controls</li>
											<li>Webhook and external integrations</li>
											<li>Audit logging for all actions</li>
										</ul>
										<div className="text-xs text-indigo-500 mt-4">
											For support, visit{" "}
											<a
												href="mailto:support@intellirack.com"
												className="underline text-indigo-600"
											>
												support@intellirack.com
											</a>{" "}
											or see our{" "}
											<a href="#" className="underline text-indigo-600">
												documentation
											</a>
											.<br />
											Your data is private and exportable at any time.
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				))}
			</div>
			{/* Sticky Save/Reset Actions */}
			<div className="flex gap-4 pt-8 border-t border-indigo-200 dark:border-indigo-900/30 mt-8 sticky bottom-0 bg-white/60 dark:bg-slate-700/40 backdrop-blur-lg z-10">
				<button
					onClick={saveSettings}
					disabled={isLoading}
					className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 text-white rounded-xl hover:from-indigo-600 hover:via-fuchsia-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
				>
					{isLoading ? "Saving..." : "Save Settings"}
				</button>
				<button
					onClick={resetSettings}
					className="px-4 py-2.5 bg-rose-700/25 text-rose-200 rounded-xl hover:bg-rose-700/35 font-semibold border border-rose-500/40 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
				>
					Reset
				</button>
			</div>
		</div>
	);
}
