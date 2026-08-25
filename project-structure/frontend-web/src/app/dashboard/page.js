"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components";
import { useRouter } from "next/navigation";
import { getUser, logout, refreshUser } from "@/lib/auth";
import io from "socket.io-client";
import GlassTabs from "@/components/GlassTabs";
import { useTheme } from "@/contexts/ThemeContext";
import { MoonStar, SunMedium } from "lucide-react";
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
} from "recharts";
import Image from "next/image";
import slot from "../../../public/images/slot.png";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import DeviceList from "@/components/dashboard/DeviceList";
import DeviceSheet from "@/components/dashboard/DeviceSheet";
import AddDeviceCard from "@/components/dashboard/AddDeviceCard";
import StatsOverview from "@/components/dashboard/StatsOverview";
import LiveStatusWidget from "@/components/dashboard/LiveStatusWidget";
import AlertsWidget from "@/components/dashboard/AlertsWidget";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import ProfileWidget from "@/components/dashboard/ProfileWidget";
import SettingsWidget from "@/components/dashboard/SettingsWidget";
import LogsList from "@/components/dashboard/LogsList";
import AlertsList from "@/components/dashboard/AlertsList";
import ChartsWidget from "@/components/dashboard/ChartsWidget";
import GradientCard from "@/components/GradientCard";
import StatusDot from "@/components/StatusDot";
import CloseButton from "@/components/CloseButton";
import { AreaChart, Area } from "recharts";
import IngredientsTab from "@/components/dashboard/IngredientsTab";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import MultiDeviceMonitor from "@/components/dashboard/MultiDeviceMonitor";
const API_BASE = process.env.NEXT_API_URL;

const TABS = [
	"Dashboard",
	"Devices",
	// "Monitor",
	"Ingredients",
	"Alerts",
	"Settings",
];

// Placeholder data for charts
const ingredientPieData = [
	{ name: "Protein", value: 400 },
	{ name: "Carbs", value: 300 },
	{ name: "Fats", value: 300 },
];
const COLORS = ["#6366f1", "#a21caf", "#f472b6"];
const usageBarData = [
	{ name: "Jan", usage: 1200 },
	{ name: "Feb", usage: 2100 },
	{ name: "Mar", usage: 800 },
	{ name: "Apr", usage: 1600 },
	{ name: "May", usage: 900 },
	{ name: "Jun", usage: 1700 },
	{ name: "Jul", usage: 1400 },
	{ name: "Aug", usage: 1100 },
	{ name: "Sep", usage: 1300 },
	{ name: "Oct", usage: 1500 },
	{ name: "Nov", usage: 1000 },
	{ name: "Dec", usage: 1800 },
];
const activityTimeline = [
	{ time: "09:00", event: "Device A: Added Rice" },
	{ time: "10:30", event: "Device B: Low Stock Alert" },
	{ time: "12:00", event: "Device A: Removed Flour" },
	{ time: "13:45", event: "Device C: Added Sugar" },
	{ time: "15:00", event: "Device B: Empty Slot" },
];

export default function DashboardPage() {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [devices, setDevices] = useState([]);
	const [logs, setLogs] = useState([]);
	const [alerts, setAlerts] = useState([]);
	const [liveStatus, setLiveStatus] = useState({});
	const [error, setError] = useState("");
	const [tab, setTab] = useState(TABS[0]);
	const [selectedDevice, setSelectedDevice] = useState(null);
	const router = useRouter();
	const socketRef = useRef(null);
	const [ingredients, setIngredients] = useState([]);
	const [ingredientDetails, setIngredientDetails] = useState(null);
	const [ingredientModalOpen, setIngredientModalOpen] = useState(false);

	// Loading states for better UX
	const [devicesLoading, setDevicesLoading] = useState(false);
	const [logsLoading, setLogsLoading] = useState(false);
	const [alertsLoading, setAlertsLoading] = useState(false);
	const [ingredientsLoading, setIngredientsLoading] = useState(false);

	// Add caching for ingredient predictions
	const [predictionsCache, setPredictionsCache] = useState({});
	const [lastPredictionsUpdate, setLastPredictionsUpdate] = useState(0);
	const [lastIngredientsUpdate, setLastIngredientsUpdate] = useState(0);
	const PREDICTIONS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	const normalizeId = (value) =>
		value === undefined || value === null
			? ""
			: String(value).trim().toLowerCase();

	const dedupeDevices = (list) => {
		const seen = new Set();
		return (Array.isArray(list) ? list : []).filter((device) => {
			const key = normalizeId(device.rackId || device._id);
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};

	const fetchDevices = async () => {
		try {
			setDevicesLoading(true);
			const token = localStorage.getItem("token");
			const response = await fetch(`${API_BASE}/devices/my`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (response.ok) {
				const devicesData = await response.json();
				setDevices(dedupeDevices(devicesData));
			}
		} catch (error) {
			console.error("Error fetching devices:", error);
		} finally {
			setDevicesLoading(false);
		}
	};

	useEffect(() => {
		if (!user) return;

		const intervalId = setInterval(() => {
			fetchDevices();
		}, 5000);

		return () => clearInterval(intervalId);
	}, [user]);

	const fetchLogs = async () => {
		try {
			setLogsLoading(true);
			const token = localStorage.getItem("token");
			const response = await fetch(`${API_BASE}/logs/?limit=50`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (response.ok) {
				const data = await response.json();
				setLogs(data.logs || data); // Handle both new and old format
			}
		} catch (error) {
			console.error("Error fetching logs:", error);
		} finally {
			setLogsLoading(false);
		}
	};

	// Optimized fetch for dashboard overview (limited data)
	const fetchDashboardData = async () => {
		try {
			const token = localStorage.getItem("token");
			console.log("Dashboard - Token exists:", !!token);
			console.log(
				"Dashboard - Token preview:",
				token ? token.substring(0, 20) + "..." : "No token"
			);
			console.log("Dashboard - API_BASE:", API_BASE);

			const headers = {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			};
			console.log("Dashboard - Headers:", headers);

			// Fetch devices
			setDevicesLoading(true);
			const devicesRes = await fetch(`${API_BASE}/devices/my`, { headers });
			if (devicesRes.ok) {
				const devicesData = await devicesRes.json();
				setDevices(dedupeDevices(devicesData));
			}
			setDevicesLoading(false);

			// Fetch limited alerts for dashboard
			setAlertsLoading(true);
			const alertsRes = await fetch(
				`${API_BASE}/alerts/?status=active&limit=5`,
				{ headers }
			);
			if (alertsRes.ok) {
				const data = await alertsRes.json();
				setAlerts(data.alerts || data); // Handle both new and old format
			}
			setAlertsLoading(false);

			// Fetch limited logs for dashboard
			setLogsLoading(true);
			const logsRes = await fetch(`${API_BASE}/logs/?limit=3&sort=newest`, {
				headers,
			});
			if (logsRes.ok) {
				const data = await logsRes.json();
				setLogs(data.logs || data); // Handle both new and old format
			}
			setLogsLoading(false);

			// Fetch ingredients summary for dashboard overview
			setIngredientsLoading(true);
			console.log(
				"Dashboard - Fetching ingredients from:",
				`${API_BASE}/ingredients/summary`
			);
			const ingredientsRes = await fetch(`${API_BASE}/ingredients/summary`, {
				headers,
			});
			console.log(
				"Dashboard - Ingredients response status:",
				ingredientsRes.status
			);
			console.log("Dashboard - Ingredients response ok:", ingredientsRes.ok);

			if (ingredientsRes.ok) {
				const ingredientsData = await ingredientsRes.json();
				console.log("Dashboard - Raw ingredients data:", ingredientsData);

				// IMMEDIATE RENDER: Show ingredients first, then enhance with predictions
				setIngredients(ingredientsData);
				console.log(
					"Dashboard - Ingredients rendered immediately:",
					ingredientsData.length
				);

				// BACKGROUND ENHANCEMENT: Load predictions in background
				setTimeout(async () => {
					try {
						const ingredientNames = ingredientsData.map((ing) => ing.name);
						console.log(
							`Dashboard - Background: Fetching batch predictions for ${ingredientNames.length} ingredients`
						);

						// Check if we have valid cached predictions
						const now = Date.now();
						const cacheIsValid =
							now - lastPredictionsUpdate < PREDICTIONS_CACHE_DURATION;
						const hasCachedPredictions =
							Object.keys(predictionsCache).length > 0;

						if (cacheIsValid && hasCachedPredictions) {
							console.log("Dashboard - Using cached predictions");

							// Enhance ingredients with cached predictions
							const enhancedIngredients = ingredientsData.map((ingredient) => {
								const cachedPrediction = predictionsCache[ingredient.name];
								return {
									...ingredient,
									daysLeft: cachedPrediction?.prediction ?? null,
									predictionError: cachedPrediction?.error || null,
								};
							});

							setIngredients(enhancedIngredients);
						} else {
							// Fetch fresh predictions
							console.log("Dashboard - Starting batch prediction fetch...");
							const startTime = Date.now();

							// Add timeout to prevent hanging requests
							const controller = new AbortController();
							const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

							try {
								const predictionParams = new URLSearchParams();
								ingredientNames.forEach((name) => {
									predictionParams.append("ingredients", name);
								});

								const batchPredRes = await fetch(
									`${API_BASE}/ingredients/predictions/batch?${predictionParams.toString()}`,
									{
										headers,
										signal: controller.signal,
									}
								);

								clearTimeout(timeoutId);
								const fetchTime = Date.now() - startTime;
								console.log(
									`Dashboard - Batch prediction completed in ${fetchTime}ms`
								);

								if (batchPredRes.ok) {
									const batchData = await batchPredRes.json();
									console.log(
										"Dashboard - Batch predictions received:",
										batchData
									);

									// Cache the predictions
									const newCache = {};
									batchData.predictions.forEach((pred) => {
										newCache[pred.ingredient] = pred;
									});
									setPredictionsCache(newCache);
									setLastPredictionsUpdate(now);

									// Enhance ingredients with batch predictions
									const enhancedIngredients = ingredientsData.map(
										(ingredient) => {
											const prediction = batchData.predictions.find(
												(p) => p.ingredient === ingredient.name
											);
											return {
												...ingredient,
												daysLeft: prediction?.prediction ?? null,
												predictionError: prediction?.error || null,
											};
										}
									);

									console.log(
										"Dashboard - Enhanced ingredients with batch predictions:",
										enhancedIngredients.length
									);
									setIngredients(enhancedIngredients);
								} else {
									console.warn(
										"Dashboard - Batch prediction failed, using ingredients without predictions"
									);
									setIngredients(ingredientsData);
								}
							} catch (error) {
								console.error(
									"Dashboard - Error fetching batch predictions:",
									error
								);
								// Fallback to ingredients without predictions
								setIngredients(ingredientsData);
							}
						}
					} catch (error) {
						console.error(
							"Dashboard - Error fetching batch predictions:",
							error
						);
						// Fallback to ingredients without predictions
						setIngredients(ingredientsData);
					}
				}, 0); // Schedule for next tick
			} else {
				console.error(
					"Dashboard - Failed to fetch ingredients:",
					ingredientsRes.status,
					ingredientsRes.statusText
				);
			}
			setIngredientsLoading(false);
		} catch (error) {
			console.error("Error fetching dashboard data:", error);
		}
	};

	const fetchAlerts = async (includeAcknowledged = false) => {
		try {
			setAlertsLoading(true);
			const token = localStorage.getItem("token");
			// Fetch active alerts by default, or all alerts if includeAcknowledged is true
			const statusParam = includeAcknowledged ? "" : "?status=active";
			const response = await fetch(
				`${API_BASE}/alerts/${statusParam}&limit=25`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);
			if (response.ok) {
				const data = await response.json();
				setAlerts(data.alerts || data); // Handle both new and old format
			}
		} catch (error) {
			console.error("Error fetching alerts:", error);
		} finally {
			setAlertsLoading(false);
		}
	};

	const fetchAllAlerts = async () => {
		try {
			setAlertsLoading(true);
			const token = localStorage.getItem("token");
			// Fetch all alerts (including acknowledged ones) for the Alerts tab
			const response = await fetch(`${API_BASE}/alerts/?limit=25`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (response.ok) {
				const data = await response.json();
				setAlerts(data.alerts || data); // Handle both new and old format
			}
		} catch (error) {
			console.error("Error fetching all alerts:", error);
		} finally {
			setAlertsLoading(false);
		}
	};

	const fetchIngredients = async () => {
		try {
			setIngredientsLoading(true);
			const token = localStorage.getItem("token");
			const response = await fetch(`${API_BASE}/ingredients/summary`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (response.ok) {
				const data = await response.json();
				setIngredients(data);
				setLastIngredientsUpdate(Date.now()); // Track when data was last updated
				console.log(
					"Dashboard - Ingredients data updated at:",
					new Date().toLocaleString()
				);
			}
		} catch (error) {
			console.error("Error fetching ingredients:", error);
		} finally {
			setIngredientsLoading(false);
		}
	};

	const handleAlertAcknowledged = async (alertId) => {
		try {
			console.log("Dashboard - Alert acknowledged, refreshing data...");

			// Refresh alerts data to reflect the acknowledgment
			// Only fetch active alerts since dashboard should only show unacknowledged ones
			await fetchAlerts(false); // false = only active alerts

			// Also refresh dashboard data to ensure consistency
			// This ensures the dashboard overview shows the updated alerts
			await fetchDashboardData();

			console.log(
				"Dashboard - Data refreshed successfully after acknowledgment"
			);
		} catch (error) {
			console.error(
				"Dashboard - Error refreshing alerts after acknowledgment:",
				error
			);
		}
	};

	const handleAlertModified = async () => {
		try {
			// Refresh alerts data when child component modifies alerts
			await fetchAllAlerts();
		} catch (error) {
			console.error(
				"Dashboard - Error refreshing alerts after modification:",
				error
			);
		}
	};

	const validateAndCleanAlerts = async () => {
		try {
			// Fetch fresh alerts from backend to validate current state
			const token = localStorage.getItem("token");
			const response = await fetch(`${API_BASE}/alerts/?limit=50`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				const data = await response.json();
				const backendAlerts = data.alerts || data;
				const backendAlertIds = new Set(backendAlerts.map((a) => a._id));

				// Check if current alerts state has any IDs that don't exist in backend
				const staleAlerts = alerts.filter(
					(alert) => !backendAlertIds.has(alert._id)
				);

				if (staleAlerts.length > 0) {
					console.warn(
						"Dashboard - Found stale alerts, cleaning up:",
						staleAlerts.length
					);
					console.log(
						"Dashboard - Stale alert IDs:",
						staleAlerts.map((a) => a._id)
					);

					// Update state to only include alerts that exist in backend
					setAlerts(backendAlerts);
				}
			}
		} catch (error) {
			console.error("Dashboard - Error validating alerts:", error);
		}
	};

	useEffect(() => {
		async function fetchEssentialData() {
			try {
				const token = localStorage.getItem("token");
				if (!token) {
					router.replace("/login");
					return;
				}

				console.log("Dashboard - Starting fetchEssentialData");
				console.log("Dashboard - User state:", user);

				// Refresh user data to ensure we have the latest information
				const refreshedUser = await refreshUser();
				if (refreshedUser) {
					setUser(refreshedUser);
					console.log("Dashboard - User refreshed:", refreshedUser);
				} else {
					// Fallback to local user data
					const localUser = getUser();
					if (localUser) {
						setUser(localUser);
						console.log("Dashboard - Using local user:", localUser);
					} else {
						router.replace("/login");
						return;
					}
				}

				// Only fetch essential data initially
				console.log("Dashboard - Calling fetchDashboardData");
				await fetchDashboardData();

				// Validate and clean any stale alerts that might exist
				await validateAndCleanAlerts();

				setLoading(false);
			} catch (err) {
				console.error("Dashboard - Error in fetchEssentialData:", err);
				setError(err.message);
				setLoading(false);
			}
		}
		fetchEssentialData();
	}, [router]);

	// Lazy load data when tabs are accessed
	useEffect(() => {
		if (tab === "Alerts" && alerts.length === 0 && !alertsLoading) {
			fetchAllAlerts();
		}
		if (tab === "Logs" && logs.length === 0 && !logsLoading) {
			fetchLogs();
		}
		if (
			tab === "Ingredients" &&
			ingredients.length === 0 &&
			!ingredientsLoading
		) {
			fetchIngredients();
		}
	}, [
		tab,
		alerts.length,
		logs.length,
		ingredients.length,
		alertsLoading,
		logsLoading,
		ingredientsLoading,
	]);

	// Fetch full data when switching to tabs that need it
	useEffect(() => {
		if (tab === "Alerts" && alerts.length <= 5) {
			// Dashboard only has 5 alerts, fetch full list for Alerts tab
			fetchAllAlerts();
			// Also validate and clean any stale alerts
			validateAndCleanAlerts();
		}
		if (tab === "Logs" && logs.length <= 3) {
			// Dashboard only has 3 logs, fetch full list for Logs tab
			fetchLogs();
		}
		// REMOVED: Ingredients tab no longer reloads on every click
		// Ingredients are loaded once and cached
	}, [tab]);

	useEffect(() => {
		if (!user) return;

		console.log("User object for socket auth:", user);
		console.log("User ID:", user.id || user._id);

		const socket = io(API_BASE.replace("/api", ""), {
			transports: ["websocket"],
			auth: {
				token: localStorage.getItem("token"),
			},
		});
		socketRef.current = socket;

		socket.on("connect", () => {
			console.log("Connected to server");
			// Authenticate socket with user ID
			const userId = user.id || user._id;
			if (userId) {
				console.log(
					`💻 Web WebSocket connected, authenticating user: ${userId}`
				);
				socket.emit("authenticate", {
					userId,
					clientType: "web",
					timestamp: Date.now(),
				});
			} else {
				console.error("No user ID found in user object:", user);
				console.error("Available user fields:", Object.keys(user));
			}
		});

		socket.on("authenticated", (data) => {
			console.log("Socket authenticated:", data);
		});

		// Handle real-time device updates with improved filtering
		const onUpdateDashboard = (data) => {
			console.log("Dashboard - update received:", data);
			console.log(
				"Dashboard - Current devices:",
				devices.map((d) => d.rackId)
			);

			// Ensure we have valid deviceId
			if (!data.deviceId) {
				console.warn("Dashboard - No deviceId in update:", data);
				return;
			}

			setLiveStatus((prev) => {
				const { deviceId, slotId, ...rest } = data;
				return {
					...prev,
					[deviceId]: {
						...(prev[deviceId] || {}),
						[slotId]: rest,
					},
				};
			});

			// Also update devices state with real-time data
			setDevices((prev) => {
				const updated = prev.map((device) => {
					const incomingId = normalizeId(data.deviceId);
					const rackId = normalizeId(device.rackId);
					const mongoId = normalizeId(device._id);
					// Check both rackId and _id for device matching
					const isTargetDevice = incomingId === rackId || incomingId === mongoId;

					if (isTargetDevice) {
						console.log(
							`Dashboard - Updating device ${device.rackId} with data:`,
							data
						);
						return {
							...device,
							isOnline: data.isOnline ?? device.isOnline,
							lastSeen: data.lastSeen ?? device.lastSeen,
							// Update real-time data
							lastWeight: data.weight ?? device.lastWeight,
							lastStatus: data.status ?? device.lastStatus,
							ingredient: data.ingredient ?? device.ingredient,
						};
					}
					return device;
				});

				// Log if no device was updated
				const wasUpdated = updated.some((d, index) => d !== prev[index]);
				if (!wasUpdated) {
					console.warn(`Dashboard - No device found for ID: ${data.deviceId}`);
				}

				return updated;
			});
		};

		socket.on("update", onUpdateDashboard);

		// Handle device status updates with improved filtering
		const onStatusDashboard = (data) => {
			console.log("Dashboard - deviceStatus received:", data);
			console.log(
				"Dashboard - Current devices:",
				devices.map((d) => d.rackId)
			);

			// Ensure we have valid deviceId
			if (!data.deviceId) {
				console.warn("Dashboard - No deviceId in status update:", data);
				return;
			}

			setDevices((prev) => {
				const updated = prev.map((device) => {
					const incomingId = normalizeId(data.deviceId);
					const rackId = normalizeId(device.rackId);
					const mongoId = normalizeId(device._id);
					// Check both rackId and _id for device matching
					const isTargetDevice = incomingId === rackId || incomingId === mongoId;

					if (isTargetDevice) {
						console.log(
							`Dashboard - Updating device ${device.rackId} with status:`,
							data
						);
						return {
							...device,
							isOnline: data.isOnline,
							lastSeen: data.lastSeen,
							// Update real-time data
							lastWeight: data.weight ?? device.lastWeight,
							lastStatus: data.status ?? device.lastStatus,
							ingredient: data.ingredient ?? device.ingredient,
						};
					}
					return device;
				});

				// Log if no device was updated
				const wasUpdated = updated.some((d, index) => d !== prev[index]);
				if (!wasUpdated) {
					console.warn(`Dashboard - No device found for ID: ${data.deviceId}`);
				}

				return updated;
			});
		};

		socket.on("deviceStatus", onStatusDashboard);

		socket.on("alert", (data) => {
			console.log("Socket - Received alert:", data);
			console.log("Socket - Current alerts count:", alerts.length);

			// Validate the alert data before adding it
			if (!data._id || !data.ingredient || !data.type) {
				console.warn("Socket - Invalid alert data received:", data);
				return;
			}

			// Check if this alert already exists to prevent duplicates
			const alertExists = alerts.find((alert) => alert._id === data._id);
			if (alertExists) {
				console.log("Socket - Alert already exists, skipping:", data._id);
				return;
			}

			console.log("Socket - Adding new alert:", data._id, data.ingredient);
			setAlerts((prev) => [
				{ ...data, createdAt: new Date(), acknowledged: false },
				...prev,
			]);
		});

		socket.on("deviceRegistered", (response) => {
			if (response.success) {
				fetchDevices(); // Refresh devices list
			}
		});

		// Handle command responses with device filtering
		const onCommandResponseDashboard = (data) => {
			console.log("Dashboard - Command response received:", data);

			// Ensure we have valid deviceId
			if (!data.deviceId) {
				console.warn("Dashboard - No deviceId in command response:", data);
				return;
			}

			// Check if this response is for one of our devices
			const device = devices.find(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (device) {
				console.log(
					`Dashboard - Command response for device ${device.rackId}:`,
					data
				);
				// You can show a notification or update UI here
				// For now, just log it
			} else {
				console.log(
					`Dashboard - Command response for unknown device: ${data.deviceId}`
				);
			}
		};

		socket.on("commandResponse", onCommandResponseDashboard);

		// Utility function to send broadcast commands
		window.sendBroadcastCommand = (command, data = {}) => {
			if (socketRef.current) {
				socketRef.current.emit("sendCommand", {
					deviceId: "broadcast",
					command: "broadcast",
					broadcastCommand: command,
					...data,
				});
			}
		};

		// Utility function to send device-specific commands
		window.sendDeviceCommand = (deviceId, command, data = {}) => {
			if (socketRef.current) {
				socketRef.current.emit("sendCommand", {
					deviceId,
					command,
					...data,
				});
			}
		};

		socket.on("deviceAdded", (data) => {
			console.log("New device added:", data);
			fetchDevices(); // Refresh devices list
		});

		return () => socket.disconnect();
	}, [user]);

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

	function handleSignOut() {
		logout();
		router.replace("/login");
	}

	const handleAddDevice = () => {
		fetchDevices(); // Refresh devices after adding
		setTab("Devices");
	};
	const handleAddIngredient = () => {
		alert("Add Ingredient modal coming soon!");
	};

	if (loading)
		return (
			<div className="min-h-screen flex items-center justify-center">
				Loading...
			</div>
		);
	if (error)
		return (
			<div className="min-h-screen flex items-center justify-center text-red-500">
				{error}
			</div>
		);
	if (!user) return null;

	return (
		<DashboardLayout>
			<DashboardNavbar user={user} onSignOut={handleSignOut} tabs={TABS} currentTab={tab} onTabChange={setTab} />
			<div className="w-full max-w-6xl mx-auto">
				{/* {tab === "Dashboard" && (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadein">
						<div className="col-span-1 md:col-span-2">
							<StatsOverview
								devices={devices}
								alerts={alerts}
								logs={logs}
								liveStatus={liveStatus}
							/>
						</div>
						<div className="col-span-1">
							<LiveStatusWidget liveStatus={liveStatus} />
						</div>
						<div className="col-span-1">
							<AlertsWidget alerts={alerts} />
						</div>
						<div className="col-span-1 md:col-span-2">
							<ActivityTimeline
								timeline={activityTimeline}
								logs={logs}
								devices={devices}
							/>
						</div>
						<div className="col-span-1">
							<ProfileWidget user={user} />
						</div>
						<div className="col-span-1">
							<SettingsWidget user={user} />
						</div>
					</div>
				)} */}
				{tab === "Dashboard" && (
					<>
						{ingredientsLoading ? (
							<div className="text-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
								<p className="mt-2 text-gray-500">Loading ingredients...</p>
							</div>
						) : (
							<DashboardOverview
								onAddDevice={handleAddDevice}
								onAddIngredient={handleAddIngredient}
								devices={devices}
								alerts={alerts}
								logs={logs}
								ingredients={ingredients}
								onAlertAcknowledged={handleAlertAcknowledged}
							/>
						)}
					</>
				)}

				{tab === "Devices" && (
					<DeviceList
						devices={devices}
						onDeviceClick={setSelectedDevice}
						onAddDevice={handleAddDevice}
						socket={socketRef.current}
						liveStatus={liveStatus}
						ingredientDetails={ingredientDetails}
					/>
				)}

				{/* {tab === "Monitor" && (
					<MultiDeviceMonitor devices={devices} socket={socketRef.current} />
				)} */}
				{tab === "Ingredients" &&
					(ingredientsLoading ? (
						<div className="text-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
							<p className="mt-2 text-gray-500">
								{ingredients.length === 0
									? "Loading ingredients..."
									: "Updating ingredients..."}
							</p>
							{ingredients.length === 0 && (
								<p className="text-xs text-gray-400 mt-1">
									Fetching data and calculating predictions...
								</p>
							)}
						</div>
					) : (
						<div>
							{/* Ingredients Tab Header with Refresh Button */}
							<div className="flex items-center justify-between mb-4">
								<div>
									{/* <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
										Ingredients
									</h2> */}
									{lastIngredientsUpdate > 0 && (
										<p className="text-xs text-gray-500 mt-1">
											Last updated:{" "}
											{new Date(lastIngredientsUpdate).toLocaleString()}
										</p>
									)}
								</div>
								<button
									onClick={() => {
										console.log(
											"Dashboard - Manual refresh of ingredients requested"
										);
										fetchIngredients();
									}}
									className="px-2 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md font-semibold shadow hover:shadow-lg transition-all flex items-center gap-2"
									disabled={ingredientsLoading}
								>
									{ingredientsLoading ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
											Refreshing...
										</>
									) : (
										<>
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											Refresh
										</>
									)}
								</button>
							</div>
							<IngredientsTab ingredients={ingredients} />
						</div>
					))}
				{tab === "Logs" &&
					(logsLoading ? (
						<div className="text-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
							<p className="mt-2 text-gray-500">Loading logs...</p>
						</div>
					) : (
						<div className="text-center text-gray-500">
							Logs are now shown in the Ingredients tab.
						</div>
					))}
				{tab === "Alerts" &&
					(alertsLoading ? (
						<div className="text-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
							<p className="mt-2 text-gray-500">Loading alerts...</p>
						</div>
					) : (
						<AlertsList
							key={`alerts-${alerts.length}`}
							alerts={null} // Pass null to force AlertsList to fetch its own data
							onAlertModified={handleAlertModified}
						/>
					))}
				{tab === "Charts" && null}
				{tab === "Profile" && null}
				{tab === "Settings" && <SettingsWidget user={user} />}
			</div>
			{/* Ingredient Details Modal/Sheet */}
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
						<div className="flex items-center gap-2 mb-4">
							<StatusDot status={ingredientDetails.logs[0]?.status} />
							<h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
								{ingredientDetails.name} Details
							</h2>
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
							<div className="text-xs text-gray-500 text-right">
								Last updated:{" "}
								{ingredientDetails.logs[0]?.timestamp
									? new Date(
											ingredientDetails.logs[0]?.timestamp
									  ).toLocaleString()
									: "-"}
							</div>
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
													<div className="text-xs text-gray-500">
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
							<h3 className="font-semibold mb-2">Anomalies</h3>
							{ingredientDetails.anomalies &&
							ingredientDetails.anomalies.length > 0 ? (
								<ul className="list-disc pl-5 text-xs">
									{ingredientDetails.anomalies.map((a) => (
										<li key={a._id}>
											{a.timestamp
												? new Date(a.timestamp).toLocaleString()
												: "-"}{" "}
											- <StatusDot status={a.status} />
											{a.status} ({a.weight}g)
										</li>
									))}
								</ul>
							) : (
								<div className="text-gray-400">No anomalies detected</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2">Substitutions</h3>
							{ingredientDetails.substitutions &&
							ingredientDetails.substitutions.length > 0 ? (
								<ul className="list-disc pl-5 text-xs">
									{ingredientDetails.substitutions.map((s, i) => (
										<li key={i}>{s}</li>
									))}
								</ul>
							) : (
								<div className="text-gray-400">No substitutions found</div>
							)}
						</div>
						<div className="mb-6">
							<h3 className="font-semibold mb-2">Recommendations</h3>
							{ingredientDetails.recommendations &&
							ingredientDetails.recommendations.length > 0 ? (
								<ul className="list-disc pl-5 text-xs">
									{ingredientDetails.recommendations.map((r, i) => (
										<li key={i}>{r}</li>
									))}
								</ul>
							) : (
								<div className="text-gray-400">No recommendations</div>
							)}
						</div>
					</div>
				</div>
			)}
			<DeviceSheet
				device={selectedDevice}
				isOpen={!!selectedDevice}
				onClose={() => setSelectedDevice(null)}
				socket={socketRef.current}
			/>
		</DashboardLayout>
	);
}
