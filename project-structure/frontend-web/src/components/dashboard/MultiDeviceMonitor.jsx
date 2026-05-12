import React, { useEffect, useState } from "react";
import { API_URL } from "@/lib/auth";

/**
 * Multi-Device Monitor Component
 * Real-time monitoring and testing for multiple IntelliRack devices
 */
const MultiDeviceMonitor = ({ devices = [], socket }) => {
	const [deviceStates, setDeviceStates] = useState(new Map());
	const [messageLog, setMessageLog] = useState([]);
	const [isMonitoring, setIsMonitoring] = useState(false);
	const [testCommands, setTestCommands] = useState({});

	// Initialize device states
	useEffect(() => {
		if (devices.length > 0) {
			const newStates = new Map();
			devices.forEach((device) => {
				newStates.set(device.rackId, {
					rackId: device.rackId,
					name: device.name,
					isOnline: device.isOnline || false,
					lastWeight: 0,
					lastStatus: "UNKNOWN",
					lastUpdate: null,
					messageCount: 0,
					commandsSent: 0,
					responsesReceived: 0,
				});
			});
			setDeviceStates(newStates);
		}
	}, [devices]);

	// Socket event handlers
	useEffect(() => {
		if (!socket || !isMonitoring) return;

		const componentId = `MultiDeviceMonitor_${Date.now()}`;
		console.log(`${componentId}: Setting up multi-device WebSocket listeners`);

		// Handle device updates with filtering
		const handleUpdate = (data) => {
			// Only process updates for devices we're monitoring
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`MultiDeviceMonitor - Ignoring update for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`MultiDeviceMonitor - Processing update for device: ${data.deviceId}`,
				data
			);

			const logEntry = {
				timestamp: new Date(),
				type: "update",
				deviceId: data.deviceId,
				data: data,
			};

			setMessageLog((prev) => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 messages

			setDeviceStates((prev) => {
				const newStates = new Map(prev);
				const current = newStates.get(data.deviceId) || {};
				newStates.set(data.deviceId, {
					...current,
					isOnline: data.isOnline,
					lastWeight: data.weight,
					lastStatus: data.status,
					ingredient: data.ingredient,
					lastUpdate: new Date(),
					messageCount: (current.messageCount || 0) + 1,
				});
				return newStates;
			});
		};

		// Handle device status with filtering
		const handleDeviceStatus = (data) => {
			// Only process status for devices we're monitoring
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`MultiDeviceMonitor - Ignoring status for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`MultiDeviceMonitor - Processing status for device: ${data.deviceId}`,
				data
			);

			const logEntry = {
				timestamp: new Date(),
				type: "deviceStatus",
				deviceId: data.deviceId,
				data: data,
			};

			setMessageLog((prev) => [logEntry, ...prev.slice(0, 99)]);

			setDeviceStates((prev) => {
				const newStates = new Map(prev);
				const current = newStates.get(data.deviceId) || {};
				newStates.set(data.deviceId, {
					...current,
					isOnline: data.isOnline,
					lastSeen: data.lastSeen,
					messageCount: (current.messageCount || 0) + 1,
				});
				return newStates;
			});
		};

		// Handle command responses with filtering
		const handleCommandResponse = (data) => {
			// Only process responses for devices we're monitoring
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`MultiDeviceMonitor - Ignoring command response for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`MultiDeviceMonitor - Processing command response for device: ${data.deviceId}`,
				data
			);

			const logEntry = {
				timestamp: new Date(),
				type: "commandResponse",
				deviceId: data.deviceId,
				data: data,
			};

			setMessageLog((prev) => [logEntry, ...prev.slice(0, 99)]);

			setDeviceStates((prev) => {
				const newStates = new Map(prev);
				const current = newStates.get(data.deviceId) || {};
				newStates.set(data.deviceId, {
					...current,
					responsesReceived: (current.responsesReceived || 0) + 1,
				});
				return newStates;
			});
		};

		// Handle NFC events with filtering
		const handleNfcEvent = (data) => {
			// Only process NFC events for devices we're monitoring
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`MultiDeviceMonitor - Ignoring NFC event for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`MultiDeviceMonitor - Processing NFC event for device: ${data.deviceId}`,
				data
			);

			const logEntry = {
				timestamp: new Date(),
				type: "nfcEvent",
				deviceId: data.deviceId,
				data: data,
			};

			setMessageLog((prev) => [logEntry, ...prev.slice(0, 99)]);
		};

		// Register event listeners
		socket.on("update", handleUpdate);
		socket.on("deviceStatus", handleDeviceStatus);
		socket.on("commandResponse", handleCommandResponse);
		socket.on("nfcEvent", handleNfcEvent);

		console.log(`${componentId}: WebSocket listeners registered`);

		// Cleanup
		return () => {
			socket.off("update", handleUpdate);
			socket.off("deviceStatus", handleDeviceStatus);
			socket.off("commandResponse", handleCommandResponse);
			socket.off("nfcEvent", handleNfcEvent);
			console.log(`${componentId}: WebSocket listeners cleaned up`);
		};
	}, [socket, isMonitoring]);

	// Send test command to device
	const sendTestCommand = async (deviceId, command) => {
		if (!socket) {
			console.error("No socket connection");
			return;
		}

		try {
			const commandData = {
				deviceId: deviceId,
				command: command,
				timestamp: new Date().toISOString(),
			};

			console.log(`Sending command to ${deviceId}:`, commandData);
			socket.emit("sendCommand", commandData);

			// Update command sent count
			setDeviceStates((prev) => {
				const newStates = new Map(prev);
				const current = newStates.get(deviceId) || {};
				newStates.set(deviceId, {
					...current,
					commandsSent: (current.commandsSent || 0) + 1,
				});
				return newStates;
			});

			// Log the command
			const logEntry = {
				timestamp: new Date(),
				type: "commandSent",
				deviceId: deviceId,
				data: commandData,
			};
			setMessageLog((prev) => [logEntry, ...prev.slice(0, 99)]);
		} catch (error) {
			console.error("Error sending command:", error);
		}
	};

	// Toggle monitoring
	const toggleMonitoring = () => {
		setIsMonitoring(!isMonitoring);
		if (!isMonitoring) {
			setMessageLog([]);
		}
	};

	// Clear logs
	const clearLogs = () => {
		setMessageLog([]);
	};

	// Format timestamp
	const formatTime = (timestamp) => {
		return timestamp.toLocaleTimeString();
	};

	// Get device state
	const getDeviceState = (deviceId) => {
		return deviceStates.get(deviceId) || {};
	};

	return (
		<div className="p-6 bg-white rounded-lg shadow-lg">
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-800">
					Multi-Device Monitor
				</h2>
				<div className="flex gap-2">
					<button
						onClick={toggleMonitoring}
						className={`px-4 py-2 rounded-lg font-medium ${
							isMonitoring
								? "bg-red-500 hover:bg-red-600 text-white"
								: "bg-green-500 hover:bg-green-600 text-white"
						}`}
					>
						{isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
					</button>
					<button
						onClick={clearLogs}
						className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
					>
						Clear Logs
					</button>
				</div>
			</div>

			{/* Device Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
				{devices.map((device) => {
					const state = getDeviceState(device.rackId);
					return (
						<div
							key={device.rackId}
							className="bg-gray-50 border rounded-lg p-4"
						>
							<div className="flex justify-between items-start mb-3">
								<div>
									<h3 className="font-bold text-lg">{device.rackId}</h3>
									<p className="text-sm text-gray-600">{device.name}</p>
								</div>
								<div
									className={`w-3 h-3 rounded-full ${
										state.isOnline ? "bg-green-500" : "bg-red-500"
									}`}
								/>
							</div>

							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Weight:</span>
									<span className="font-mono">{state.lastWeight || 0}g</span>
								</div>
								<div className="flex justify-between">
									<span>Status:</span>
									<span className="font-mono">
										{state.lastStatus || "UNKNOWN"}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Messages:</span>
									<span className="font-mono">{state.messageCount || 0}</span>
								</div>
								<div className="flex justify-between">
									<span>Commands:</span>
									<span className="font-mono">{state.commandsSent || 0}</span>
								</div>
								<div className="flex justify-between">
									<span>Responses:</span>
									<span className="font-mono">
										{state.responsesReceived || 0}
									</span>
								</div>
								{state.lastUpdate && (
									<div className="flex justify-between">
										<span>Last Update:</span>
										<span className="font-mono text-xs">
											{formatTime(state.lastUpdate)}
										</span>
									</div>
								)}
							</div>

							{/* Test Commands */}
							<div className="mt-4 space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={() => sendTestCommand(device.rackId, "tare")}
										className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										Tare
									</button>
									<button
										onClick={() => sendTestCommand(device.rackId, "status")}
										className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										Status
									</button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<button
										onClick={() => {
											const confirmed = window.confirm(
												`Calibrate ${device.rackId}\n\n` +
													"Auto-calibration with 100g known weight.\n\n" +
													"⚠️ IMPORTANT:\n" +
													"• Have exactly 100g weight ready\n" +
													"• Remove all items from scale first\n" +
													"• Place 100g when prompted\n" +
													"• Do not touch during process\n" +
													"• Negative factors are normal\n\n" +
													"Continue?"
											);
											if (confirmed) {
												sendTestCommand(device.rackId, "calibrate");
											}
										}}
										className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										Calibrate
									</button>
									<button
										onClick={() => sendTestCommand(device.rackId, "restart")}
										className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										Restart
									</button>
									<button
										onClick={() => sendTestCommand(device.rackId, "led_on")}
										className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										LED On
									</button>
									<button
										onClick={() => sendTestCommand(device.rackId, "led_off")}
										className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded"
										disabled={!socket || !state.isOnline}
									>
										LED Off
									</button>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Message Log */}
			{isMonitoring && (
				<div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
					<h3 className="text-white mb-2">
						Live Message Log ({messageLog.length})
					</h3>
					{messageLog.length === 0 ? (
									<div className="text-gray-500 dark:text-slate-300">Waiting for messages...</div>
					) : (
						messageLog.map((entry, index) => (
							<div key={index} className="mb-1">
								<span className="text-blue-400">
									[{formatTime(entry.timestamp)}]
								</span>
								<span
									className={`ml-2 ${
										entry.type === "update"
											? "text-green-400"
											: entry.type === "commandSent"
											? "text-yellow-400"
											: entry.type === "commandResponse"
											? "text-cyan-400"
											: "text-white"
									}`}
								>
									{entry.type.toUpperCase()}
								</span>
								<span className="text-purple-400 ml-2">{entry.deviceId}</span>
								<span className="text-gray-300 ml-2">
									{JSON.stringify(entry.data, null, 0)}
								</span>
							</div>
						))
					)}
				</div>
			)}

			{/* Statistics */}
			<div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
				<div className="bg-blue-50 p-3 rounded-lg">
					<div className="text-2xl font-bold text-blue-600">
						{devices.filter((d) => getDeviceState(d.rackId).isOnline).length}
					</div>
					<div className="text-sm text-gray-600">Online Devices</div>
				</div>
				<div className="bg-green-50 p-3 rounded-lg">
					<div className="text-2xl font-bold text-green-600">
						{Array.from(deviceStates.values()).reduce(
							(sum, state) => sum + (state.messageCount || 0),
							0
						)}
					</div>
					<div className="text-sm text-gray-600">Total Messages</div>
				</div>
				<div className="bg-yellow-50 p-3 rounded-lg">
					<div className="text-2xl font-bold text-yellow-600">
						{Array.from(deviceStates.values()).reduce(
							(sum, state) => sum + (state.commandsSent || 0),
							0
						)}
					</div>
					<div className="text-sm text-gray-600">Commands Sent</div>
				</div>
				<div className="bg-purple-50 p-3 rounded-lg">
					<div className="text-2xl font-bold text-purple-600">
						{Array.from(deviceStates.values()).reduce(
							(sum, state) => sum + (state.responsesReceived || 0),
							0
						)}
					</div>
					<div className="text-sm text-gray-600">Responses</div>
				</div>
			</div>
		</div>
	);
};

export default MultiDeviceMonitor;
