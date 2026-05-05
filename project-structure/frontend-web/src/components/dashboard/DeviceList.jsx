import React, { useEffect, useState } from "react";
import DeviceCard from "./DeviceCard";
import AddDeviceCard from "./AddDeviceCard";
import { API_URL } from "@/lib/auth";

const DeviceList = ({ devices, onDeviceClick, onAddDevice, socket }) => {
	const [deviceStatus, setDeviceStatus] = useState(new Map());
	const [editDevice, setEditDevice] = useState(null);
	const [editForm, setEditForm] = useState({ name: "", location: "" });
	const [isEditing, setIsEditing] = useState(false);
	const [ingredientDetails, setIngredientDetails] = useState(null);

	useEffect(() => {
		if (!socket) {
			console.log("DeviceList: No socket available");
			return;
		}

		const componentId = `DeviceList_${Date.now()}`;
		console.log(`${componentId}: Socket connected, setting up listeners`);
		console.log(`${componentId}: Current socket state:`, {
			connected: socket.connected,
			id: socket.id,
			readyState: socket.readyState,
		});

		// Create unique handlers for DeviceList with device filtering
		const handleDeviceStatus = (data) => {
			console.log(`${componentId} - deviceStatus received:`, data);

			// Only process status for devices we know about
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`${componentId} - Ignoring status for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`${componentId} - Processing status for device: ${data.deviceId}`,
				data
			);

			setDeviceStatus((prev) => {
				const newMap = new Map(prev);
				const currentStatus = newMap.get(data.deviceId) || {};
				const updatedStatus = {
					...currentStatus,
					isOnline: data.isOnline,
					lastSeen: data.lastSeen,
					ingredient: data.ingredient,
					weight: data.weight,
					status: data.status,
				};
				console.log(
					`${componentId} - Updating device ${data.deviceId}:`,
					updatedStatus
				);
				newMap.set(data.deviceId, updatedStatus);
				return newMap;
			});
		};

		// Listen for general updates with device filtering
		const handleUpdate = (data) => {
			console.log(`${componentId} - update received:`, data);

			// Only process updates for devices we know about
			const isOurDevice = devices.some(
				(d) => d.rackId === data.deviceId || d._id === data.deviceId
			);

			if (!isOurDevice) {
				console.log(
					`${componentId} - Ignoring update for unknown device: ${data.deviceId}`
				);
				return;
			}

			console.log(
				`${componentId} - Processing update for device: ${data.deviceId}`,
				data
			);

			setDeviceStatus((prev) => {
				const newMap = new Map(prev);
				const currentStatus = newMap.get(data.deviceId) || {};
				const updatedStatus = {
					...currentStatus,
					isOnline: data.isOnline ?? true,
					lastSeen: data.lastSeen ?? new Date(),
					ingredient: data.ingredient,
					weight: data.weight,
					status: data.status,
				};
				console.log(
					`${componentId} - Updating device ${data.deviceId}:`,
					updatedStatus
				);
				newMap.set(data.deviceId, updatedStatus);
				return newMap;
			});
		};

		// Store handler references for proper cleanup
		const handlers = {
			deviceStatus: handleDeviceStatus,
			update: handleUpdate,
		};

		// Use specific event handlers for DeviceList
		Object.entries(handlers).forEach(([event, handler]) => {
			socket.on(event, handler);
		});

		console.log(`${componentId} - Event listeners registered`);

		return () => {
			console.log(`${componentId} - Cleaning up event listeners`);
			Object.entries(handlers).forEach(([event, handler]) => {
				socket.off(event, handler);
			});
		};
	}, [socket]);

	// Fetch ingredient summary for each device
	// useEffect(() => {
	// 	const fetchSummaries = async () => {
	// 		const summaries = {};
	// 		for (const device of devices) {
	// 			try {
	// 				const res = await fetch(
	// 					`${API_URL}/logs?device=${device._id}&limit=1&sort=newest`,
	// 					{
	// 						headers: {
	// 							Authorization: `Bearer ${localStorage.getItem("token")}`,
	// 						},
	// 					}
	// 				);
	// 				if (res.ok) {
	// 					const logs = await res.json();
	// 					if (logs.length > 0) {
	// 						const log = logs[0];
	// 						summaries[
	// 							device._id
	// 						] = `${log.ingredient}: ${log.status} (${log.weight}g)`;
	// 						device.ingredient = log.ingredient;
	// 					} else {
	// 						summaries[device._id] = "No data";
	// 					}
	// 				}
	// 			} catch {
	// 				summaries[device._id] = "No data";
	// 			}
	// 		}
	// 		setIngredientSummaries(summaries);
	// 	};
	// 	if (devices.length > 0) fetchSummaries();
	// }, [devices]);

	// Mock alertTypes and ingredientSummary for each device (replace with real fetch)
	const getAlertTypes = (device) => {
		// TODO: Fetch from backend
		return device.lastStatus === "LOW" || device.lastStatus === "EMPTY"
			? [device.lastStatus]
			: [];
	};
	const getIngredientSummary = (device) => {
		// TODO: Fetch from backend
		return device.lastStatus && device.lastWeight
			? `${device.lastStatus} (${device.lastWeight.toFixed(1)}g)`
			: null;
	};

	const handleEdit = (device) => {
		setEditDevice(device);
		setEditForm({ name: device.name || "", location: device.location || "" });
		setIsEditing(true);
	};

	const handleEditSubmit = async (e) => {
		e.preventDefault();
		try {
			// console.log(API_URL);

			const res = await fetch(`${API_URL}/devices/${editDevice.rackId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify(editForm),
			});
			if (res.ok) {
				// Optionally refetch devices or update state
				setIsEditing(false);
				window.location.reload(); // For demo, reload; in real app, update state
			} else {
				alert("Failed to update device");
			}
		} catch {
			alert("Error updating device");
		}
	};

	const handleDelete = async (device) => {
		try {
			const res = await fetch(`${API_URL}/devices/${device.rackId}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});
			if (res.ok) {
				window.location.reload(); // For demo, reload; in real app, update state
			} else {
				alert("Failed to delete device");
			}
		} catch {
			alert("Error deleting device");
		}
	};

	const handleViewDetails = (device) => {
		onDeviceClick(device);
	};

	// Merge device data with real-time status (per-slot)
	const devicesWithStatus = devices.map((device) => {
		const status = deviceStatus.get(device.rackId);
		const mergedDevice = {
			...device,
			ingredient: status?.ingredient ?? device.ingredient,
			isOnline: status?.isOnline ?? device.isOnline,
			lastSeen: status?.lastSeen ?? device.lastSeen,
			lastWeight: status?.weight ?? device.lastWeight,
			lastStatus: status?.status ?? device.lastStatus,
			// Ensure we're using the real-time data when available
			weight: status?.weight ?? device.lastWeight,
			status: status?.status ?? device.lastStatus,
		};

		// Debug logging for device data merging
		if (status) {
			console.log(`Device ${device.rackId} merged data:`, {
				original: {
					ingredient: device.ingredient,
					lastWeight: device.lastWeight,
					lastStatus: device.lastStatus,
				},
				realtime: {
					ingredient: status.ingredient,
					weight: status.weight,
					status: status.status,
				},
				merged: {
					ingredient: mergedDevice.ingredient,
					weight: mergedDevice.weight,
					status: mergedDevice.status,
				},
			});
		}

		return mergedDevice;
	});

	// Debug logging for component render
	console.log("DeviceList render:", {
		devicesCount: devices.length,
		deviceStatusSize: deviceStatus.size,
		devicesWithStatusCount: devicesWithStatus.length,
		deviceStatusKeys: Array.from(deviceStatus.keys()),
		firstDeviceStatus: devicesWithStatus[0]
			? {
					rackId: devicesWithStatus[0].rackId,
					ingredient: devicesWithStatus[0].ingredient,
					weight: devicesWithStatus[0].weight,
					status: devicesWithStatus[0].status,
			  }
			: null,
	});

	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-8 animate-fadein flex flex-col gap-6">
			<h3 className="text-lg font-semibold mb-2 text-[var(--primary)]">
				Your Devices
			</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 p-6 	w-full">
				{/* Add Device Card - Always First */}

				{/* Device Cards */}
				{devicesWithStatus.map((device) => (
					<DeviceCard
						key={device._id}
						device={device}
						onDeviceClick={handleViewDetails}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onViewDetails={handleViewDetails}
						alertTypes={getAlertTypes(device)}
						ingredientDetails={ingredientDetails}
					/>
				))}
				<AddDeviceCard onClick={onAddDevice} socket={socket} />

				{/* No Devices Message */}
				{devicesWithStatus.length === 0 && (
					<div className="col-span-full text-center py-12">
						<div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
							<div className="text-gray-400 mb-4">
								<svg
									className="w-16 h-16 mx-auto"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1}
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold text-white mb-2">
								No devices registered
							</h3>
							<p className="text-gray-400 mb-6">
								Click the "+" button above to add your first IntelliRack device
							</p>
							<button
								onClick={onAddDevice}
								className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 font-medium"
							>
								Add Your First Device
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Edit Device Modal */}
			{isEditing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl">
						<h3 className="text-lg font-semibold mb-4">Edit Device</h3>
						<form onSubmit={handleEditSubmit} className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1">Name</label>
								<input
									type="text"
									value={editForm.name}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, name: e.target.value }))
									}
									className="w-full px-3 py-2 border rounded-lg"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">
									Location
								</label>
								<input
									type="text"
									value={editForm.location}
									onChange={(e) =>
										setEditForm((f) => ({ ...f, location: e.target.value }))
									}
									className="w-full px-3 py-2 border rounded-lg"
								/>
							</div>
							<div className="flex gap-2 justify-end">
								<button
									type="button"
									onClick={() => setIsEditing(false)}
									className="px-4 py-2 bg-gray-200 rounded-lg"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
								>
									Save
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default DeviceList;
