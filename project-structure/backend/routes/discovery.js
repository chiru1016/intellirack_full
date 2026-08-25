const express = require("express");
const Device = require("../models/Device");
const User = require("../models/User");
const router = express.Router();

/**
 * Device Discovery and Auto-Registration Routes
 * Handles dynamic device discovery and registration
 */

async function generateUniqueRackId(baseId) {
	let suffix = 2;
	while (suffix < 100) {
		const candidateId = `${baseId}_${suffix}`;
		const existing = await Device.findOne({ rackId: candidateId });
		if (!existing) return candidateId;
		suffix++;
	}
	// Fallback: use timestamp suffix
	return `${baseId}_${Date.now()}`;
}

// Auto-register device from discovery data
router.post("/register", async (req, res) => {
	try {
		const {
			deviceId,
			name,
			ipAddress,
			macAddress,
			firmwareVersion,
			type,
			userEmail,
			location = "Auto-discovered",
			slotId = 1
		} = req.body;

		// Validate required fields
		if (!deviceId || !ipAddress) {
			return res.status(400).json({
				error: "Missing required fields: deviceId and ipAddress are required"
			});
		}

		// Find or create user
		let user;
		if (userEmail) {
			user = await User.findOne({ email: userEmail });
			if (!user) {
				user = new User({
					name: userEmail.split('@')[0],
					email: userEmail,
					passwordHash: "auto-generated-" + Date.now(),
					devices: []
				});
				await user.save();
				console.log(`✅ Auto-created user: ${userEmail}`);
			}
		} else {
			// Use first available user if no email provided
			user = await User.findOne().sort({ createdAt: 1 });
			if (!user) {
				return res.status(400).json({
					error: "No user found and no userEmail provided for device registration"
				});
			}
		}

		// Check if device already exists — match by rackId first, then by IP
		let device = await Device.findOne({ rackId: deviceId });
		if (!device) {
			device = await Device.findOne({ physicalId: deviceId, ipAddress });
		}

		if (device) {
			const effectiveIp = device.staticIp || ipAddress;
			const ipConflict = device.physicalId == null && !device.staticIp && device.ipAddress && device.ipAddress !== ipAddress;

			if (ipConflict) {
				// Different physical device using the same firmware rackId — assign a new alias rackId
				const aliasRackId = await generateUniqueRackId(deviceId);
				device = new Device({
					name: name || `IntelliRack ${aliasRackId}`,
					rackId: aliasRackId,
					physicalId: deviceId,
					location,
					firmwareVersion: firmwareVersion || "v2.0",
					owner: user._id,
					ipAddress,
					macAddress,
					isOnline: true,
					lastSeen: new Date(),
					weightThresholds: { min: 5.0, low: 100.0, moderate: 200.0, good: 500.0, max: 5000.0 },
					settings: { ledEnabled: true, soundEnabled: false, autoTare: false, mqttPublishInterval: 1000 },
					calibrationFactor: 204.99,
				});
				await device.save();
				console.log(`➕ Created aliased device: ${aliasRackId} (physicalId: ${deviceId}) at ${ipAddress}`);
			} else {
				// Update existing device — only update ipAddress if no static IP is pinned
				device.name = name || device.name;
				if (!device.staticIp) device.ipAddress = ipAddress;
				device.macAddress = macAddress || device.macAddress;
				device.firmwareVersion = firmwareVersion || device.firmwareVersion;
				device.location = location;
				device.owner = user._id;
				device.isOnline = true;
				device.lastSeen = new Date();
				await device.save();
				console.log(`🔄 Updated existing device: ${device.rackId} at ${device.staticIp || ipAddress}`);
			}
		} else {
			// Create new device
			device = new Device({
				name: name || `IntelliRack ${deviceId}`,
				rackId: deviceId,
				location,
				firmwareVersion: firmwareVersion || "v2.0",
				owner: user._id,
				ipAddress,
				macAddress,
				isOnline: true,
				lastSeen: new Date(),
				weightThresholds: {
					min: 5.0,
					low: 100.0,
					moderate: 200.0,
					good: 500.0,
					max: 5000.0,
				},
				settings: {
					ledEnabled: true,
					soundEnabled: false,
					autoTare: false,
					mqttPublishInterval: 1000,
				},
				calibrationFactor: 204.99,
			});

			await device.save();
			console.log(`➕ Created new device: ${deviceId} at ${ipAddress}`);
		}

		// Add device to user's devices array if not already there
		if (!user.devices.includes(device._id)) {
			user.devices.push(device._id);
			await user.save();
			console.log(`✅ Added device to user ${user.email}`);
		}

		res.json({
			success: true,
			message: device.isNew ? "Device registered successfully" : "Device updated successfully",
			device: {
				id: device._id,
				rackId: device.rackId,
				name: device.name,
				location: device.location,
				ipAddress: device.ipAddress,
				isOnline: device.isOnline,
				owner: user.email
			}
		});

	} catch (error) {
		console.error("❌ Device registration error:", error);
		res.status(500).json({
			error: "Device registration failed",
			details: error.message
		});
	}
});

// Scan network for IntelliRack devices
router.post("/scan", async (req, res) => {
	try {
		const { ipRange = "192.168.1", startIp = 1, endIp = 254, timeout = 1500 } = req.body;
		
		console.log(`🔍 Scanning network range: ${ipRange}.${startIp}-${endIp}`);

		const fetchFn =
			typeof fetch === "function" ? fetch.bind(globalThis) : null;
		if (!fetchFn) {
			throw new Error(
				"Fetch API is unavailable in this Node runtime. Use Node 18+ or install a fetch polyfill."
			);
		}
		const discoveredDevices = [];
		const seenIds = new Set();
		const discoveryPaths = ["/api/discovery", "/discovery"];

		const looksLikeIntelliRack = (deviceInfo = {}) => {
			const normalizedType = String(deviceInfo.type || "").toLowerCase();
			return Boolean(
				deviceInfo.deviceId ||
				deviceInfo.rackId ||
				normalizedType.includes("intellirack") ||
				deviceInfo.firmwareVersion ||
				deviceInfo.slotId
			);
		};

		const normalizeDiscoveredDevice = (deviceInfo, ip) => {
			const deviceId =
				String(deviceInfo.deviceId || deviceInfo.rackId || "").trim() ||
				`device-${ip}`;

			return {
				deviceId,
				rackId: deviceInfo.rackId || deviceId,
				name: deviceInfo.name || `IntelliRack ${deviceId}`,
				type: deviceInfo.type || "IntelliRack",
				firmwareVersion: deviceInfo.firmwareVersion || "unknown",
				currentWeight: Number(deviceInfo.currentWeight || deviceInfo.weight || 0),
				currentStatus: deviceInfo.currentStatus || deviceInfo.status || "ONLINE",
				mqttConnected: Boolean(deviceInfo.mqttConnected),
				macAddress: deviceInfo.macAddress || "",
				ipAddress: ip,
				discoveredAt: new Date(),
			};
		};

		const probeHost = async (ip) => {
			for (const path of discoveryPaths) {
				let timeoutId;
				try {
					const controller = new AbortController();
					timeoutId = setTimeout(() => controller.abort(), timeout);
					const response = await fetchFn(`http://${ip}${path}`, {
						signal: controller.signal,
					});

					if (!response.ok) continue;

					const deviceInfo = await response.json();
					if (!looksLikeIntelliRack(deviceInfo)) continue;

					return normalizeDiscoveredDevice(deviceInfo, ip);
				} catch (error) {
					// Ignore host/path probe errors and continue probing other endpoints.
				} finally {
					if (timeoutId) clearTimeout(timeoutId);
				}
			}

			return null;
		};

		const hosts = [];
		for (let i = startIp; i <= endIp; i++) {
			hosts.push(`${ipRange}.${i}`);
		}

		// Probe hosts in true batches to avoid creating all network requests at once.
		const batchSize = 40;
		for (let i = 0; i < hosts.length; i += batchSize) {
			const batchHosts = hosts.slice(i, i + batchSize);
			const batch = batchHosts.map((ip) => probeHost(ip));
			const results = await Promise.allSettled(batch);
			
			results.forEach((result) => {
				if (result.status === "fulfilled" && result.value) {
					const uniqueKey = String(
						result.value.deviceId || result.value.rackId || result.value.ipAddress
					).toLowerCase();
					if (!seenIds.has(uniqueKey)) {
						seenIds.add(uniqueKey);
						discoveredDevices.push(result.value);
					}
				}
			});
			
			// Small delay between batches to avoid overwhelming the network
			if (i + batchSize < hosts.length) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		console.log(`✅ Network scan completed: found ${discoveredDevices.length} devices`);

		res.json({
			success: true,
			scannedRange: `${ipRange}.${startIp}-${endIp}`,
			devicesFound: discoveredDevices.length,
			devices: discoveredDevices,
			scanDuration: `${timeout}ms per IP`,
			timestamp: new Date()
		});

	} catch (error) {
		console.error("❌ Network scan error:", error);
		res.status(500).json({
			error: "Network scan failed",
			details: error.message
		});
	}
});

// Get all registered devices
router.get("/devices", async (req, res) => {
	try {
		const devices = await Device.find({})
			.populate('owner', 'name email')
			.sort({ rackId: 1 });

		const deviceList = devices.map(device => ({
			id: device._id,
			rackId: device.rackId,
			name: device.name,
			location: device.location,
			ipAddress: device.ipAddress,
			macAddress: device.macAddress,
			firmwareVersion: device.firmwareVersion,
			isOnline: device.isOnline,
			lastSeen: device.lastSeen,
			owner: device.owner ? {
				id: device.owner._id,
				name: device.owner.name,
				email: device.owner.email
			} : null,
			createdAt: device.createdAt,
			updatedAt: device.updatedAt
		}));

		res.json({
			success: true,
			deviceCount: deviceList.length,
			devices: deviceList
		});

	} catch (error) {
		console.error("❌ Error fetching devices:", error);
		res.status(500).json({
			error: "Failed to fetch devices",
			details: error.message
		});
	}
});

// Get device status by rack ID
router.get("/device/:rackId", async (req, res) => {
	try {
		const { rackId } = req.params;
		
		const device = await Device.findOne({ rackId })
			.populate('owner', 'name email');

		if (!device) {
			return res.status(404).json({
				error: "Device not found",
				rackId
			});
		}

		res.json({
			success: true,
			device: {
				id: device._id,
				rackId: device.rackId,
				name: device.name,
				location: device.location,
				ipAddress: device.ipAddress,
				macAddress: device.macAddress,
				firmwareVersion: device.firmwareVersion,
				isOnline: device.isOnline,
				lastSeen: device.lastSeen,
				lastWeight: device.lastWeight,
				lastStatus: device.lastStatus,
				owner: device.owner ? {
					id: device.owner._id,
					name: device.owner.name,
					email: device.owner.email
				} : null,
				settings: device.settings,
				weightThresholds: device.weightThresholds,
				calibrationFactor: device.calibrationFactor,
				createdAt: device.createdAt,
				updatedAt: device.updatedAt
			}
		});

	} catch (error) {
		console.error("❌ Error fetching device:", error);
		res.status(500).json({
			error: "Failed to fetch device",
			details: error.message
		});
	}
});

// Bulk register devices
router.post("/bulk-register", async (req, res) => {
	try {
		const { devices, userEmail, location = "Bulk registered" } = req.body;

		if (!devices || !Array.isArray(devices) || devices.length === 0) {
			return res.status(400).json({
				error: "Devices array is required"
			});
		}

		// Find or create user
		let user;
		if (userEmail) {
			user = await User.findOne({ email: userEmail });
			if (!user) {
				user = new User({
					name: userEmail.split('@')[0],
					email: userEmail,
					passwordHash: "bulk-registered-" + Date.now(),
					devices: []
				});
				await user.save();
				console.log(`✅ Auto-created user for bulk registration: ${userEmail}`);
			}
		} else {
			user = await User.findOne().sort({ createdAt: 1 });
			if (!user) {
				return res.status(400).json({
					error: "No user found and no userEmail provided for bulk registration"
				});
			}
		}

		const results = [];
		const errors = [];

		for (const deviceData of devices) {
			try {
				const { rackId, name, ipAddress } = deviceData;

				if (!rackId) {
					errors.push({ device: deviceData, error: "Missing rackId" });
					continue;
				}

				// Check if device already exists
				let device = await Device.findOne({ rackId });

				if (device) {
					// Update existing device
					device.name = name || device.name;
					device.ipAddress = ipAddress || device.ipAddress;
					device.location = location;
					device.owner = user._id;
					device.isOnline = true;
					device.lastSeen = new Date();
					
					await device.save();
					
					results.push({
						rackId,
						action: "updated",
						device: {
							id: device._id,
							rackId: device.rackId,
							name: device.name,
							ipAddress: device.ipAddress
						}
					});
				} else {
					// Create new device
					device = new Device({
						name: name || `IntelliRack ${rackId}`,
						rackId,
						location,
						firmwareVersion: "v2.0",
						owner: user._id,
						ipAddress,
						isOnline: true,
						lastSeen: new Date(),
						weightThresholds: {
							min: 5.0,
							low: 100.0,
							moderate: 200.0,
							good: 500.0,
							max: 5000.0,
						},
						settings: {
							ledEnabled: true,
							soundEnabled: false,
							autoTare: false,
							mqttPublishInterval: 1000,
						},
						calibrationFactor: 204.99,
					});

					await device.save();
					
					results.push({
						rackId,
						action: "created",
						device: {
							id: device._id,
							rackId: device.rackId,
							name: device.name,
							ipAddress: device.ipAddress
						}
					});
				}

				// Add device to user's devices array if not already there
				if (!user.devices.includes(device._id)) {
					user.devices.push(device._id);
				}

			} catch (error) {
				errors.push({ device: deviceData, error: error.message });
			}
		}

		// Save user with updated devices
		await user.save();

		res.json({
			success: true,
			message: `Bulk registration completed: ${results.length} devices processed`,
			results,
			errors,
			summary: {
				processed: results.length,
				created: results.filter(r => r.action === "created").length,
				updated: results.filter(r => r.action === "updated").length,
				failed: errors.length,
				user: user.email
			}
		});

	} catch (error) {
		console.error("❌ Bulk registration error:", error);
		res.status(500).json({
			error: "Bulk registration failed",
			details: error.message
		});
	}
});

module.exports = router;
