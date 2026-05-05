import { useEffect, useState, useRef } from "react";
import GradientCard from "@/components/GradientCard";
import StatusDot from "@/components/StatusDot";
import CloseButton from "@/components/CloseButton";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { API_URL } from "@/lib/auth";

const API_BASE = API_URL;

export default function IngredientsTab({ onIngredientChange }) {
	const [ingredients, setIngredients] = useState([]); // [{ name, status, weight, lastUpdated, daysLeft, usageData, ... }]
	const [ingredientDetails, setIngredientDetails] = useState(null); // { name, logs, prediction, usage, anomalies, substitutions, recommendations }
	const [ingredientModalOpen, setIngredientModalOpen] = useState(false);

	useEffect(() => {
		const fetchIngredients = async () => {
			const token = localStorage.getItem("token");
			const uniqueRes = await fetch(`${API_BASE}/ingredients/unique`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!uniqueRes.ok) return;
			const uniqueIngredients = await uniqueRes.json();
			const ingredientCards = await Promise.all(
				uniqueIngredients.map(async (name) => {
					// Fetch latest log
					const logRes = await fetch(
						`${API_BASE}/ingredients/logs/${encodeURIComponent(name)}`,
						{
							headers: { Authorization: `Bearer ${token}` },
						}
					);
					const logs = logRes.ok ? await logRes.json() : [];
					const latest = logs[0] || {};
					// Fetch prediction
					const predRes = await fetch(
						`${API_BASE}/ingredients/prediction/${encodeURIComponent(name)}`,
						{
							headers: { Authorization: `Bearer ${token}` },
						}
					);
					const prediction = predRes.ok ? await predRes.json() : {};
					// Fetch usage
					const usageRes = await fetch(
						`${API_BASE}/ingredients/usage/${encodeURIComponent(name)}`,
						{
							headers: { Authorization: `Bearer ${token}` },
						}
					);
					const usage = usageRes.ok ? await usageRes.json() : [];
					return {
						name,
						status: latest.status,
						weight: latest.weight,
						lastUpdated: latest.timestamp,
						daysLeft: prediction.prediction,
						usageData: usage,
						logs,
						prediction,
					};
				})
			);
			setIngredients(ingredientCards);
			if (onIngredientChange) onIngredientChange(ingredientCards);
		};
		fetchIngredients();
	}, [onIngredientChange]);

	const openIngredientDetails = async (ingredient) => {
		const token = localStorage.getItem("token");
		const [
			logsRes,
			predRes,
			usageRes,
			anomaliesRes,
			subsRes,
			recsRes,
			patternRes,
		] = await Promise.all([
			fetch(
				`${API_BASE}/ingredients/logs/${encodeURIComponent(ingredient.name)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
			fetch(
				`${API_BASE}/ingredients/prediction/${encodeURIComponent(
					ingredient.name
				)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
			fetch(
				`${API_BASE}/ingredients/usage/${encodeURIComponent(ingredient.name)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
			fetch(
				`${API_BASE}/ingredients/anomalies/${encodeURIComponent(
					ingredient.name
				)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
			fetch(
				`${API_BASE}/ingredients/substitutions/${encodeURIComponent(
					ingredient.name
				)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
			fetch(`${API_BASE}/ingredients/recommendations`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
			fetch(
				`${API_BASE}/ingredients/usage-pattern/${encodeURIComponent(
					ingredient.name
				)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			),
		]);
		const [
			logs,
			prediction,
			usage,
			anomalies,
			substitutions,
			recommendations,
			usagePattern,
		] = await Promise.all([
			logsRes.ok ? logsRes.json() : [],
			predRes.ok ? predRes.json() : {},
			usageRes.ok ? usageRes.json() : [],
			anomaliesRes.ok ? anomaliesRes.json() : [],
			subsRes.ok ? subsRes.json() : [],
			recsRes.ok ? recsRes.json() : [],
			patternRes.ok ? patternRes.json() : {},
		]);
		setIngredientDetails({
			name: ingredient.name,
			logs,
			prediction,
			usage,
			anomalies,
			substitutions,
			recommendations,
			usagePattern,
		});
		setIngredientModalOpen(true);
	};

	const deleteIngredient = async (ingredientName) => {
		if (
			!window.confirm(
				`Delete all data for ingredient "${ingredientName}"? This cannot be undone.`
			)
		)
			return;
		const token = localStorage.getItem("token");
		try {
			await fetch(
				`${API_BASE}/ingredients/${encodeURIComponent(ingredientName)}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			setIngredientModalOpen(false);
			// Refresh ingredient list
			const uniqueRes = await fetch(`${API_BASE}/ingredients/unique`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (uniqueRes.ok) {
				const uniqueIngredients = await uniqueRes.json();
				const ingredientCards = await Promise.all(
					uniqueIngredients.map(async (name) => {
						const logRes = await fetch(
							`${API_BASE}/ingredients/logs/${encodeURIComponent(name)}`,
							{ headers: { Authorization: `Bearer ${token}` } }
						);
						const logs = logRes.ok ? await logRes.json() : [];
						const latest = logs[0] || {};
						const predRes = await fetch(
							`${API_BASE}/ingredients/prediction/${encodeURIComponent(name)}`,
							{ headers: { Authorization: `Bearer ${token}` } }
						);
						const prediction = predRes.ok ? await predRes.json() : {};
						const usageRes = await fetch(
							`${API_BASE}/ingredients/usage/${encodeURIComponent(name)}`,
							{ headers: { Authorization: `Bearer ${token}` } }
						);
						const usage = usageRes.ok ? await usageRes.json() : [];
						return {
							name,
							status: latest.status,
							weight: latest.weight,
							lastUpdated: latest.timestamp,
							daysLeft: prediction.prediction,
							usageData: usage,
							logs,
							prediction,
						};
					})
				);
				setIngredients(ingredientCards);
			}
		} catch (err) {
			alert("Failed to delete ingredient: " + err.message);
		}
	};

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{ingredients.map((ingredient) => (
					<div key={ingredient.name} className="relative">
						<GradientCard
							status={ingredient.status}
							className="cursor-pointer group"
						>
							<div
								className="absolute top-4 right-4 z-10"
								onClick={(e) => e.stopPropagation()}
							>
								{/* Placeholder for future menu */}
							</div>
							<div
								className="flex items-center gap-2 mb-2"
								onClick={() => openIngredientDetails(ingredient)}
							>
								<StatusDot status={ingredient.status} />
								<h3 className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
									{ingredient.name}
								</h3>
							</div>
							<div className="mb-1 text-gray-700 flex items-center gap-2">
								<span className="font-semibold">
									{ingredient.status || "-"}
								</span>
								<span className="text-xs text-gray-400">Status</span>
							</div>
							<div className="mb-1 text-gray-700 flex items-center gap-2">
								<span className="font-semibold">
									{ingredient.weight || "-"}g
								</span>
								<span className="text-xs text-gray-400">Weight</span>
							</div>
							<div className="mb-1 text-gray-700 flex items-center gap-2">
								<span className="font-semibold">
									{ingredient.daysLeft ?? "-"}
								</span>
								<span className="text-xs text-gray-400">Days Left</span>
							</div>
								<div className="mb-2 text-xs text-gray-500 dark:text-slate-300">
								Last updated:{" "}
								{ingredient.lastUpdated
									? new Date(ingredient.lastUpdated).toLocaleString()
									: "-"}
							</div>
							{ingredient.usageData && ingredient.usageData.length > 0 && (
								<ResponsiveContainer width="100%" height={40}>
									<AreaChart
										data={ingredient.usageData}
										margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
									>
										<defs>
											<linearGradient
												id="colorUsage"
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor="#6366f1"
													stopOpacity={0.8}
												/>
												<stop
													offset="95%"
													stopColor="#6366f1"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<XAxis dataKey="date" hide />
										<YAxis hide />
										<Tooltip />
										<Area
											type="monotone"
											dataKey="totalUsed"
											stroke="#6366f1"
											fillOpacity={1}
											fill="url(#colorUsage)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							)}
						</GradientCard>
						<div
							className="absolute inset-0 z-0 "
							onClick={() => openIngredientDetails(ingredient)}
						/>
					</div>
				))}
			</div>
			{ingredientModalOpen && ingredientDetails && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-lg border-2 border-white/30 shadow-2xl"
					onClick={() => setIngredientModalOpen(false)}
				>
					<div
						className="relative bg-white/30 dark:bg-zinc-900/60 backdrop-blur-2xl rounded-2xl border-2 border-white/30 shadow-2xl w-full max-w-4xl p-8 overflow-y-auto max-h-[90vh] animate-fadein"
						onClick={(e) => e.stopPropagation()}
					>
						<CloseButton onClick={() => setIngredientModalOpen(false)} />
						<div className="flex justify-between items-center mb-4">
							<div className="flex items-center gap-2">
								<StatusDot status={ingredientDetails.logs[0]?.status} />
								<h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
									{ingredientDetails.name} Details
								</h2>
							</div>
							<button
								onClick={() => deleteIngredient(ingredientDetails.name)}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold shadow mt-0 mr-7"
							>
								Delete Ingredient
							</button>
						</div>
						<div className="mb-4 grid grid-cols-2 gap-4">
							<div>
								<div className="text-gray-700 mb-1">
									<span className="font-semibold">
										{ingredientDetails.logs[0]?.status || "-"}
									</span>
									<span className="text-xs text-gray-400 ml-2">Status</span>
								</div>
								<div className="text-gray-700 mb-1">
									<span className="font-semibold">
										{ingredientDetails.logs[0]?.weight || "-"}g
									</span>
									<span className="text-xs text-gray-400 ml-2">Weight</span>
								</div>
								<div className="text-gray-700 mb-1">
									<span className="font-semibold">
										{ingredientDetails.prediction?.prediction ?? "-"}
									</span>
									<span className="text-xs text-gray-400 ml-2">Days Left</span>
								</div>
							</div>
								<div className="text-xs text-gray-500 dark:text-slate-300 text-right">
								Last updated:{" "}
								{ingredientDetails.logs[0]?.timestamp
									? new Date(
											ingredientDetails.logs[0]?.timestamp
									  ).toLocaleString()
									: "-"}
							</div>
						</div>
						{/* Usage Trend Chart */}
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-blue-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M3 17v-2a4 4 0 018 0v2"
									/>
								</svg>
								Usage Trend
							</h3>
							{ingredientDetails.usage && ingredientDetails.usage.length > 0 ? (
								<ResponsiveContainer width="100%" height={120}>
									<AreaChart
										data={ingredientDetails.usage}
										margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
									>
										<defs>
											<linearGradient
												id="modalColorUsage"
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor="#a21caf"
													stopOpacity={0.8}
												/>
												<stop
													offset="95%"
													stopColor="#f472b6"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<XAxis dataKey="date" />
										<YAxis />
										<Tooltip />
										<Area
											type="monotone"
											dataKey="totalUsed"
											stroke="#a21caf"
											fillOpacity={1}
											fill="url(#modalColorUsage)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							) : (
								<div className="text-gray-400">No usage data</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-indigo-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3"
									/>
								</svg>
								Log History
							</h3>
							<div className="max-h-48 overflow-y-auto px-2">
								<ul className="relative border-l-2 border-indigo-200">
									{ingredientDetails.logs.map((log, idx) => (
										<li key={log._id} className="mb-6 ml-4 relative">
											<div className="absolute -left-2 top-1.5">
												<StatusDot status={log.status} />
											</div>
											<div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl shadow p-3 flex flex-col md:flex-row md:items-center gap-2">
												<div className="flex-1">
													<div className="font-semibold text-sm text-indigo-700">
														{log.timestamp
															? new Date(log.timestamp).toLocaleString()
															: "-"}
													</div>
													<div className="text-xs text-gray-500 dark:text-slate-300">
														{log.device?.name || log.device?.rackId || "-"}
													</div>
												</div>
												<div className="flex items-center gap-3">
													<span className="text-sm font-bold text-gray-700 flex items-center gap-1">
														<svg
															className="w-4 h-4 text-blue-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6"
															/>
														</svg>
														{log.weight}g
													</span>
													<span className="text-xs font-medium px-2 py-1 rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 text-indigo-700">
														{log.status}
													</span>
												</div>
											</div>
										</li>
									))}
								</ul>
							</div>
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-pink-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 17v-2a4 4 0 018 0v2"
									/>
								</svg>
								Usage Patterns
							</h3>
							{ingredientDetails.usagePattern && (
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl shadow p-4 flex flex-col items-center">
											<span className="text-xs text-gray-500 dark:text-slate-300 mb-1">
											Avg Daily Usage
										</span>
										<span className="text-2xl font-bold text-indigo-600">
											{ingredientDetails.usagePattern.avgDaily?.toFixed(1) || 0}
											g
										</span>
									</div>
									<div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl shadow p-4">
											<span className="text-xs text-gray-500 dark:text-slate-300 mb-1 block">
											Per Day (7d)
										</span>
										<div className="flex flex-wrap gap-2">
											{ingredientDetails.usagePattern.perDay?.map((d) => (
												<span
													key={d.date}
													className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium"
												>
													{d.date}: {d.used}g
												</span>
											))}
										</div>
									</div>
									<div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl shadow p-4">
										<span className="text-xs text-gray-500 mb-1 block">
											Per Week (4w)
										</span>
										<div className="flex flex-wrap gap-2">
											{ingredientDetails.usagePattern.perWeek?.map((w) => (
												<span
													key={w.week}
													className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium"
												>
													{w.week}: {w.used}g
												</span>
											))}
										</div>
									</div>
									<div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl shadow p-4 col-span-1 md:col-span-3">
										<span className="text-xs text-gray-500 mb-1 block">
											Per Month (12m)
										</span>
										<div className="flex flex-wrap gap-2">
											{ingredientDetails.usagePattern.perMonth?.map((m) => (
												<span
													key={m.month}
													className="px-2 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-medium"
												>
													{m.month}: {m.used}g
												</span>
											))}
										</div>
									</div>
								</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-red-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M18.364 5.636l-1.414 1.414A9 9 0 105.636 18.364l1.414-1.414"
									/>
								</svg>
								Anomalies
							</h3>
							{ingredientDetails.anomalies &&
							ingredientDetails.anomalies.length > 0 ? (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{ingredientDetails.anomalies.map((a) => (
										<div
											key={a._id}
											className="flex items-center gap-3 bg-red-50/70 dark:bg-red-900/30 rounded-xl p-3 shadow border border-red-200"
										>
											<div className="flex-shrink-0">
												<StatusDot status={a.status} />
											</div>
											<div className="flex-1">
													<div className="text-xs text-gray-500 dark:text-slate-300 mb-1 flex items-center gap-1">
													<svg
														className="w-4 h-4 text-red-400"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M13 16h-1v-4h-1m1-4h.01"
														/>
													</svg>
													{a.timestamp
														? new Date(a.timestamp).toLocaleString()
														: "-"}
												</div>
												<div className="font-semibold text-red-700 text-sm flex items-center gap-2">
													{a.status}{" "}
													<span className="text-xs font-normal text-gray-400">
														({a.weight}g)
													</span>
												</div>
												{a.reason && (
													<div className="text-xs text-gray-400 mt-1">
														{a.reason}
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-gray-400">No anomalies detected</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-yellow-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3"
									/>
								</svg>
								Substitutions
							</h3>
							{ingredientDetails.substitutions &&
							ingredientDetails.substitutions.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{ingredientDetails.substitutions.map((s, i) => (
										<span
											key={i}
											className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium shadow border border-yellow-200"
										>
											<svg
												className="w-4 h-4 text-yellow-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 6h16M4 12h16M4 18h16"
												/>
											</svg>
											{s}
										</span>
									))}
								</div>
							) : (
								<div className="text-gray-400">No substitutions found</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2 flex items-center gap-2">
								<svg
									className="w-5 h-5 text-green-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4"
									/>
								</svg>
								Recommendations
							</h3>
							{ingredientDetails.recommendations &&
							ingredientDetails.recommendations.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{ingredientDetails.recommendations.map((r, i) => (
										<span
											key={i}
											className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium shadow border border-green-200"
										>
											<svg
												className="w-4 h-4 text-green-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											{r}
										</span>
									))}
								</div>
							) : (
								<div className="text-gray-400">No recommendations</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
