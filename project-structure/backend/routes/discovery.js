const express = require("express");
const Device = require("../models/Device");
const User = require("../models/User");
const router = express.Router();

/**
 * Device Discovery and Auto-Registration Routes
 * Handles dynamic device discovery and registration
 */

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

		// Check if device already exists
		let device = await Device.findOne({
			$or: [{ rackId: deviceId }, { ipAddress: ipAddress }]
		});

		if (device) {
			// Update existing device
			device.name = name || device.name;
			device.ipAddress = ipAddress;
			device.macAddress = macAddress || device.macAddress;
			device.firmwareVersion = firmwareVersion || device.firmwareVersion;
			device.location = location;
			device.owner = user._id;
			device.isOnline = true;
			device.lastSeen = new Date();
			
			await device.save();
			
			console.log(`🔄 Updated existing device: ${deviceId} at ${ipAddress}`);
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
		const { ipRange = "192.168.1", startIp = 1, endIp = 254, timeout = 2000 } = req.body;
		
		console.log(`🔍 Scanning network range: ${ipRange}.${startIp}-${endIp}`);
		
		const fetch = require('node-fetch');
		const discoveredDevices = [];
		const scanPromises = [];

		// Create scan promises for IP range
		for (let i = startIp; i <= endIp; i++) {
			const ip = `${ipRange}.${i}`;
			
			const scanPromise = (async () => {
				try {
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), timeout);
					
					const response = await fetch(`http://${ip}/api/discovery`, {
						signal: controller.signal,
						timeout: timeout
					});
					
					clearTimeout(timeoutId);
					
					if (response.ok) {
						const deviceInfo = await response.json();
						
						// Verify this is an IntelliRack device
						if (deviceInfo.type === "IntelliRack" && deviceInfo.deviceId) {
							return {
								...deviceInfo,
								ipAddress: ip,
								discoveredAt: new Date()
							};
						}
					}
				} catch (error) {
					// Ignore errors - most IPs won't have devices
				}
				return null;
			})();
			
			scanPromises.push(scanPromise);
		}

		// Wait for all scans with a reasonable batch size
		const batchSize = 50;
		for (let i = 0; i < scanPromises.length; i += batchSize) {
			const batch = scanPromises.slice(i, i + batchSize);
			const results = await Promise.allSettled(batch);
			
			results.forEach(result => {
				if (result.status === 'fulfilled' && result.value) {
					discoveredDevices.push(result.value);
				}
			});
			
			// Small delay between batches to avoid overwhelming the network
			if (i + batchSize < scanPromises.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
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
