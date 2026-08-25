import React, { useState, useEffect } from "react";
import CloseButton from "@/components/CloseButton";
import { API_URL, getToken } from "@/lib/auth";

const AddDeviceCard = ({ onClick, socket }) => {
	const [showDiscovery, setShowDiscovery] = useState(false);
	const [isDiscovering, setIsDiscovering] = useState(false);
	const [discoveredDevices, setDiscoveredDevices] = useState([]);
	const [registrationForm, setRegistrationForm] = useState({
		name: "",
		rackId: "",
		location: "",
	});
	const [selectedDevice, setSelectedDevice] = useState(null);

	// Log socket connection status
	useEffect(() => {
		console.log("AddDeviceCard: Socket available:", !!socket);
		if (socket) {
			console.log("AddDeviceCard: Socket connected:", socket.connected);
			console.log("AddDeviceCard: Socket ID:", socket.id);

			// Listen for connection events
			socket.on("connect", () => {
				console.log("AddDeviceCard: Socket connected with ID:", socket.id);
			});

			socket.on("disconnect", () => {
				console.log("AddDeviceCard: Socket disconnected");
			});

			socket.on("connect_error", (error) => {
				console.error("AddDeviceCard: Socket connection error:", error);
			});
		}
	}, [socket]);

	const scanNetwork = async () => {
		setIsDiscovering(true);
		setDiscoveredDevices([]);

		try {
			// Use backend scan only to avoid browser LAN/CORS and mixed-content restrictions.
			console.log("Starting backend-assisted discovery...");
			const discovered = await scanViaServer();
			console.log("Backend discovery devices found:", discovered);

			// Remove duplicates based on deviceId
			const uniqueDevices = discovered.filter(
				(device, index, self) =>
					index ===
					self.findIndex(
						(d) =>
							String(d.deviceId || "").toLowerCase() ===
								String(device.deviceId || "").toLowerCase()
					)
			);

			console.log("Total unique devices found:", uniqueDevices);

			// If no devices found, show a helpful message and test device
			if (uniqueDevices.length === 0) {
				console.log("No devices found via backend scan.");
				setDiscoveredDevices([]);
			} else {
				setDiscoveredDevices(uniqueDevices);
			}
		} catch (error) {
			console.error("Discovery error:", error);
			setDiscoveredDevices([]);
		} finally {
			setIsDiscovering(false);
		}
	};

	const scanViaServer = async () => {
		const defaultRanges = ["192.168.1", "192.168.0", "10.0.0", "172.16.0"];
		const host = typeof window !== "undefined" ? window.location.hostname : "";
		const hostParts = host.split(".");
		const derivedRange =
			hostParts.length === 4 && hostParts.every((part) => /^\d+$/.test(part))
				? `${hostParts[0]}.${hostParts[1]}.${hostParts[2]}`
				: null;
		const ranges = Array.from(
			new Set([...(derivedRange ? [derivedRange] : []), ...defaultRanges])
		);
		const token = getToken();
		const discovered = [];

		for (const ipRange of ranges) {
			try {
				const response = await fetch(`${API_URL}/discovery/scan`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					body: JSON.stringify({
						ipRange,
						startIp: 1,
						endIp: 254,
						timeout: 1200,
					}),
				});

				if (!response.ok) {
					console.warn(`Backend scan failed for ${ipRange}: ${response.status}`);
					continue;
				}

				const data = await response.json();
				if (Array.isArray(data.devices)) {
					discovered.push(...data.devices);
					if (data.devices.length > 0) {
						break;
					}
				}
			} catch (error) {
				console.log(`Backend scan failed for ${ipRange}:`, error.message);
			}
		}

		return discovered;
	};

	const getCurrentIP = async () => {
		try {
			// Try to get current IP through a service
			const response = await fetch("https://api.ipify.org?format=json");
			const data = await response.json();
			return data.ip;
		} catch (error) {
			console.log("Could not get current IP");
			return null;
		}
	};

	const scanNetworkRange = async (baseIP) => {
		const devices = [];
		const promises = [];

		// Scan likely ESP32 ranges plus higher DHCP addresses used by many routers
		const commonIPs = [];

		// Common IoT range
		for (let i = 100; i <= 120; i++) {
			commonIPs.push(`${baseIP}.${i}`);
		}

		// High DHCP range (covers devices like x.x.x.204)
		for (let i = 200; i <= 254; i++) {
			commonIPs.push(`${baseIP}.${i}`);
		}

		// Add router IPs
		commonIPs.push(`${baseIP}.1`);
		commonIPs.push(`${baseIP}.254`);

		// Check for IntelliRack devices on common ports
		const ports = [80]; // Focus on port 80 for ESP32 devices

		for (const ip of commonIPs) {
			for (const port of ports) {
				promises.push(
					checkDevice(ip, port)
						.then((device) => {
							if (device) {
								console.log(`Found device at ${ip}:${port}:`, device);
								devices.push(device);
							}
						})
						.catch(() => {})
				);
			}
		}

		// Wait for all checks to complete (with timeout)
		await Promise.allSettled(promises);
		return devices;
	};

	const checkDevice = async (ip, port) => {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

			// Try HTTPS first (for hosted environments)
			let response;
			try {
				response = await fetch(`https://${ip}:${port}/api/discovery`, {
					signal: controller.signal,
					mode: "cors",
				});
			} catch (httpsError) {
				// If HTTPS fails, try HTTP (for local development)
				try {
					response = await fetch(`http://${ip}:${port}/api/discovery`, {
						signal: controller.signal,
						mode: "cors",
					});
				} catch (httpError) {
					// Both failed
					clearTimeout(timeoutId);
					return null;
				}
			}

			clearTimeout(timeoutId);

			if (response.ok) {
				const deviceData = await response.json();
				return {
					...deviceData,
					ipAddress: ip,
					port: port,
				};
			}
		} catch (error) {
			// Device not found or not responding
		}
		return null;
	};

	const scanMDNS = async () => {
		try {
			// Try to use mDNS discovery if available
			if (navigator.serviceWorker) {
				// Register a service worker for mDNS discovery
				const registration = await navigator.serviceWorker.register("/sw.js");
				console.log("Service worker registered for mDNS");

				// Try to discover IntelliRack devices via mDNS
				const devices = await discoverIntelliRackDevices();
				return devices;
			}
		} catch (error) {
			console.log("mDNS not supported, using HTTP discovery only");
		}

		// Fallback: Try to discover via common mDNS patterns
		return await discoverViaHTTP();
	};

	const discoverIntelliRackDevices = async () => {
		const devices = [];

		// Try common IntelliRack device names
		const deviceNames = [
			"intellirack_rack_001",
			"intellirack_rack_002",
			"intellirack_rack_003",
			"intellirack.local",
		];

		for (const deviceName of deviceNames) {
			try {
				const response = await fetch(`http://${deviceName}/api/discovery`, {
					mode: "cors",
					signal: AbortSignal.timeout(3000),
				});

				if (response.ok) {
					const deviceData = await response.json();
					devices.push({
						...deviceData,
						ipAddress: deviceName,
						discoveredVia: "mDNS",
					});
				}
			} catch (error) {
				// Device not found
			}
		}

		return devices;
	};

	const discoverViaHTTP = async () => {
		// Try to discover devices by scanning common ESP32 IPs
		const commonIPs = [
			"192.168.1.100",
			"192.168.1.101",
			"192.168.1.102",
			"192.168.0.100",
			"192.168.0.101",
			"192.168.0.102",
			"192.168.0.105", // From the logs, this one responded with 500
			"10.0.0.100",
			"10.0.0.101",
			"10.0.0.102",
		];

		const devices = [];

		for (const ip of commonIPs) {
			try {
				console.log(`Trying ${ip}/api/discovery...`);

				// Try HTTPS first (for hosted environments)
				let response;
				try {
					response = await fetch(`https://${ip}/api/discovery`, {
						mode: "cors",
						signal: AbortSignal.timeout(3000),
					});
				} catch (httpsError) {
					// If HTTPS fails, try HTTP (for local development)
					try {
						response = await fetch(`http://${ip}/api/discovery`, {
							mode: "cors",
							signal: AbortSignal.timeout(3000),
						});
					} catch (httpError) {
						console.log(`${ip} connection failed:`, httpError.message);
						continue;
					}
				}

				if (response.ok) {
					const deviceData = await response.json();
					console.log(`Found device at ${ip}:`, deviceData);
					devices.push({
						...deviceData,
						ipAddress: ip,
						discoveredVia: response.url.startsWith("https") ? "HTTPS" : "HTTP",
					});
				} else {
					console.log(`${ip} responded with status: ${response.status}`);
				}
			} catch (error) {
				console.log(`${ip} connection failed:`, error.message);
			}
		}

		return devices;
	};

	const scanHTTPS = async () => {
		const devices = [];
		const commonHTTPSIPs = [
			"https://intellirack.local", // Example for local network
			"https://192.168.1.100", // Example for specific IP
			"https://192.168.0.100",
			"https://10.0.0.100",
			"https://172.16.0.100",
		];

		for (const url of commonHTTPSIPs) {
			try {
				const response = await fetch(url, {
					mode: "cors",
					signal: AbortSignal.timeout(3000),
				});

				if (response.ok) {
					const deviceData = await response.json();
					console.log(`Found device at ${url}:`, deviceData);
					devices.push({
						...deviceData,
						ipAddress: url, // Store the URL as the IP
						discoveredVia: "HTTPS",
					});
				} else {
					console.log(`${url} responded with status: ${response.status}`);
				}
			} catch (error) {
				console.log(`${url} connection failed:`, error.message);
			}
		}
		return devices;
	};

	const startDiscovery = async () => {
		await scanNetwork();
	};

	const registerDevice = async (device) => {
		console.log("Register device called with:", device);
		console.log("Socket available:", !!socket);
		console.log("Registration form:", registrationForm);

		if (!socket) {
			alert(
				"Socket connection not available. Please refresh the page and try again."
			);
			return;
		}

		// Check server health first
		try {
			const healthResponse = await fetch(
				process.env.NEXT_API_URL + "/health"
			);
			if (healthResponse.ok) {
				const healthData = await healthResponse.json();
				console.log("Server health check:", healthData);
			} else {
				console.error("Server health check failed:", healthResponse.status);
			}
		} catch (error) {
			console.error("Server health check error:", error);
		}

		try {
			const deviceData = {
				...registrationForm,
				rackId: device.deviceId || registrationForm.rackId,
				firmwareVersion: device.firmwareVersion || "v2.0",
				ipAddress: device.ipAddress,
				macAddress: device.macAddress,
			};

			console.log("Sending device data:", deviceData);
			console.log("Socket connected:", socket.connected);
			console.log("Socket ID:", socket.id);

			// Add a timeout for the registration response
			const registrationPromise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Registration timeout - no response from server"));
				}, 10000); // 10 second timeout

				socket.once("deviceRegistered", (response) => {
					clearTimeout(timeout);
					console.log("Registration response received:", response);
					resolve(response);
				});

				console.log("Emitting registerDevice event...");
				socket.emit("registerDevice", deviceData);
				console.log("registerDevice event emitted");
			});

			const response = await registrationPromise;

			if (response.success) {
				console.log("Device registered successfully");
				setShowDiscovery(false);
				setRegistrationForm({ name: "", rackId: "", location: "" });
				setSelectedDevice(null);
				// Optionally refresh the device list
				if (onClick) onClick();
			} else {
				console.error("Registration failed:", response.error);
				alert("Registration failed: " + response.error);
			}
		} catch (error) {
			console.error("Registration error:", error);
			alert("Registration failed: " + error.message);
		}
	};

	const handleManualAdd = () => {
		setShowDiscovery(true);
		setDiscoveredDevices([]);
		setSelectedDevice(null);
	};

	const selectDevice = (device) => {
		setSelectedDevice(device);
		setRegistrationForm((prev) => ({
			...prev,
			rackId: device.deviceId,
			name: device.name || `IntelliRack ${device.deviceId}`,
		}));
	};

	return (
		<>
			{/* Add Device Card */}
			<div
				className="relative group cursor-pointer transition-all duration-300 hover:scale-105"
				onClick={handleManualAdd}
			>
				<div className="relative overflow-hidden rounded-2xl bg-white/10  border border-white/20 shadow-2xl hover:shadow-3xl transition-all duration-300">
					<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

					<div className="relative p-6 flex flex-col items-center justify-center min-h-[280px]">
						{/* Plus Icon */}
						<div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
							<svg
								className="w-8 h-8 text-white"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 6v6m0 0v6m0-6h6m-6 0H6"
								/>
							</svg>
						</div>

						{/* Text */}
						<h3 className="text-lg font-semibold text-white mb-2">
							Add Device
						</h3>
						<p className="text-sm text-gray-300 text-center">
							Discover and register new IntelliRack devices on your network
						</p>
					</div>
				</div>
			</div>

			{/* Discovery Modal */}
			{showDiscovery && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center"
					onClick={() => setShowDiscovery(false)}
				>
					<div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg z-[-1]" />
					<div
						className="relative bg-white/30 dark:bg-zinc-900/60 backdrop-blur-2xl rounded-2xl border-2 border-white/30 dark:border-zinc-700 shadow-2xl w-full max-w-4xl p-8 overflow-y-auto max-h-[90vh] animate-fadein"
						onClick={(e) => e.stopPropagation()}
					>
						<CloseButton onClick={() => setShowDiscovery(false)} />
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
								Add New Device
							</h2>
						</div>
						<div className="overflow-y-auto min-h-0">
							{/* Discovery Section */}
							<div className="mb-6">
								<h3 className="text-lg font-semibold text-black mb-4">
									Device Discovery
								</h3>

								{!isDiscovering && discoveredDevices.length === 0 && (
									<div className="text-center py-8">
										<button
											onClick={startDiscovery}
											className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 font-medium"
										>
											Start Discovery
										</button>
										<p className="text-sm text-gray-400 mt-2">
											Scan your local network for IntelliRack devices
										</p>

										{/* Mixed Content Warning */}
										<div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
											<h4 className="text-yellow-400 font-medium mb-2">
												Discovery Note
											</h4>
											<p className="text-sm text-black mb-3">
												If you're accessing this app over HTTPS and no devices
												are found, it may be due to browser security policies
												blocking HTTP requests to local devices.
											</p>
											<div className="text-xs text-gray-400 space-y-1">
												<p>
													<strong>Solutions:</strong>
												</p>
												<p>• Access the app via HTTP (http://localhost:3000)</p>
												<p>
													• Configure your ESP32 devices with HTTPS certificates
												</p>
												<p>• Use the demo device below for testing</p>
											</div>
										</div>
									</div>
								)}

								{isDiscovering && (
									<div className="text-center py-8">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
										<p className="text-white">
											Scanning network for devices...
										</p>
										<p className="text-sm text-gray-400 mt-2">
											This may take a few moments
										</p>
									</div>
								)}

								{discoveredDevices.length > 0 && (
									<div className="space-y-3">
										<h4 className="text-black font-medium">
											Discovered Devices:
										</h4>
										{discoveredDevices.map((device, index) => (
											<div
												key={index}
												className={`bg-white/5 rounded-lg p-4 border cursor-pointer transition-colors ${
													selectedDevice?.deviceId === device.deviceId
														? "border-indigo-500 bg-indigo-500/10"
														: "border-white/10 hover:border-white/20"
												}`}
												onClick={() => selectDevice(device)}
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-2">
															<h5 className="text-black font-medium">
																{typeof device.name === "string"
																	? device.name
																	: device.deviceId || "Unknown Device"}
															</h5>
															<span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
																{device.currentStatus}
															</span>
							
														</div>
														<div className="grid grid-cols-2 gap-2 text-sm">
															<div>
																<span className="text-black">Rack ID:</span>
																<span className="text-black ml-2">
																	{device.deviceId}
																</span>
															</div>
															<div>
																<span className="text-black">IP:</span>
																<span className="text-black ml-2">
																	{device.ipAddress}
																</span>
															</div>
															<div>
																<span className="text-black">Weight:</span>
																<span className="text-black ml-2">
																	{device.currentWeight}g
																</span>
															</div>
															<div>
																<span className="text-black">Firmware:</span>
																<span className="text-black ml-2">
																	{device.firmwareVersion}
																</span>
															</div>
														</div>
													</div>
													<div className="text-right">
														<div
															className={`w-3 h-3 rounded-full ${
																device.mqttConnected
																	? "bg-green-400"
																	: "bg-red-400"
															}`}
														></div>
														<p className="text-xs text-gray-400 mt-1">
															{device.mqttConnected ? "MQTT" : "No MQTT"}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Manual Entry Option */}
							{!isDiscovering && discoveredDevices.length === 0 && (
								<div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
									<h4 className="text-blue-400 font-medium mb-2">
										Manual Device Entry
									</h4>
									<p className="text-sm text-black mb-3">
										If automatic discovery doesn't work, you can manually enter
										device details.
									</p>
									<button
										onClick={() => {
											const uniqueId = "IR-" + Array.from(crypto.getRandomValues(new Uint8Array(4)))
												.map((b) => b.toString(16).padStart(2, "0"))
												.join("").toUpperCase();
											setSelectedDevice({
												deviceId: uniqueId,
												slotId: 1,
												name: "",
												type: "IntelliRack",
												firmwareVersion: "v2.0",
												ipAddress: "",
												macAddress: "",
												isManual: true,
											});
											setRegistrationForm((prev) => ({ ...prev, rackId: uniqueId, name: "" }));
										}}
										className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
									>
										Enter Device Manually
									</button>
								</div>
							)}

							{/* Registration Form */}
							{selectedDevice && (
								<div className="bg-white/40 dark:bg-zinc-900/40 border border-white/30 dark:border-zinc-700 shadow-xl rounded-xl p-6">
									<h3 className="text-lg font-semibold text-black mb-4">
										Register Device
									</h3>
									<div className="space-y-4">
										<div>
											<label className="block text-sm text-black mb-2">
												Device Name
											</label>
											<input
												type="text"
												value={registrationForm.name}
												onChange={(e) =>
													setRegistrationForm((prev) => ({
														...prev,
														name: e.target.value,
													}))
												}
												placeholder="e.g., Kitchen Rack 1"
												className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-black focus:outline-none focus:border-indigo-500"
											/>
										</div>
										<div>
											<label className="block text-sm text-black mb-2">
												Rack ID
											</label>
											<input
												type="text"
												value={registrationForm.rackId}
												onChange={(e) =>
													setRegistrationForm((prev) => ({
														...prev,
														rackId: e.target.value,
													}))
												}
												placeholder="e.g., rack_001"
												className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-black focus:outline-none focus:border-indigo-500"
												readOnly={!selectedDevice.isManual}
											/>
											<p className="text-xs text-gray-400 mt-1">
												{selectedDevice.isManual
													? "Enter the device ID manually"
													: "Auto-filled from discovered device"}
											</p>
										</div>
										{selectedDevice.isManual && (
											<div>
												<label className="block text-sm text-black mb-2">
													IP Address
												</label>
												<input
													type="text"
													value={selectedDevice.ipAddress}
													onChange={(e) =>
														setSelectedDevice((prev) => ({
															...prev,
															ipAddress: e.target.value,
														}))
													}
													placeholder="e.g., 192.168.1.100"
													className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-black focus:outline-none focus:border-indigo-500"
												/>
											</div>
										)}
										<div>
											<label className="block text-sm text-black mb-2">
												Location
											</label>
											<input
												type="text"
												value={registrationForm.location}
												onChange={(e) =>
													setRegistrationForm((prev) => ({
														...prev,
														location: e.target.value,
													}))
												}
												placeholder="e.g., Kitchen, Pantry"
												className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-black focus:outline-none focus:border-indigo-500"
											/>
										</div>
									</div>
									<div className="flex gap-3 mt-6">
										<button
											onClick={() => registerDevice(selectedDevice)}
											className="flex-1 px-4 py-2 bg-green-600 text-black rounded-lg hover:bg-green-700 transition-colors"
										>
											Register Device
										</button>
										<button
											onClick={() => setShowDiscovery(false)}
											className="px-4 py-2 bg-gray-600 text-black rounded-lg hover:bg-gray-700 transition-colors"
										>
											Cancel
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default AddDeviceCard;
