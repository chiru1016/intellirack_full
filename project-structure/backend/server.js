require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const setupMQTT = require("./mqtt/client");
const Device = require("./models/Device");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: [
			"http://localhost:3000",
			"http://localhost:3030",
			"https://intellirack.judesonleo.dev",
		],
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowedHeaders: ["Content-Type", "Authorization"],
	},
});
const corsOptions = {
	origin: [
		"http://localhost:3000",
		"http://localhost:3001",
		"https://intellirack.judesonleo.dev",
		"https://intellirack.judesonleo.me",
	],
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.set("io", io);
app.set("port", process.env.PORT || 3000);
app.set("mongoURI", process.env.MONGO_URI);

app.use("/api/devices", require("./routes/devices"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/warehouse", require("./routes/warehouse"));
app.use("/api/nfc", require("./routes/nfc"));
app.use("/api/ingredients", require("./routes/ingredients"));
app.use("/api/discovery", require("./routes/discovery"));
app.use("/api/user", require("./routes/user"));

// Metrics and monitoring endpoints
app.use("/api/metrics", require("./routes/metrics"));
app.use("/health", require("./routes/metrics")); // Health check at root level

function normalizeRackId(rackId) {
	if (rackId === undefined || rackId === null) return "";
	return String(rackId).trim().toLowerCase();
}

function normalizeIpAddress(ipAddress) {
	if (ipAddress === undefined || ipAddress === null) return undefined;
	const normalized = String(ipAddress).trim();
	return normalized || undefined;
}

// WebSocket connection handling
io.on("connection", (socket) => {
	console.log("Client connected:", socket.id);

	// Handle socket authentication
	socket.on("authenticate", async (data) => {
		try {
			const { userId, clientType, timestamp } = data;
			if (userId) {
				socket.userId = userId;
				socket.clientType = clientType || "unknown";
				socket.authTimestamp = timestamp || Date.now();

				// Join user-specific room for device updates
				socket.join(`user:${userId}`);

				// Log all sockets in this room for debugging
				const roomSockets = await io.in(`user:${userId}`).fetchSockets();
				console.log(
					`🔐 Socket ${socket.id} (${clientType}) authenticated for user ${userId} and joined room user:${userId}`
				);
				console.log(
					`👥 Total sockets in room user:${userId}: ${roomSockets.length}`
				);
				roomSockets.forEach((s) => {
					console.log(
						`   - Socket ${s.id} (${
							s.clientType || "unknown"
						}) auth: ${new Date(s.authTimestamp || 0).toISOString()}`
					);
				});

				socket.emit("authenticated", { success: true, userId, clientType });
			} else {
				socket.emit("authenticated", {
					success: false,
					error: "No user ID provided",
				});
			}
		} catch (error) {
			console.error("Authentication error:", error);
			socket.emit("authenticated", { success: false, error: error.message });
		}
	});

	// Handle device commands from frontend
	socket.on("sendCommand", async (data) => {
		try {
			const { deviceId, command, ...commandData } = data;
			const normalizedRackId = normalizeRackId(deviceId);

			console.log(
				`Sending command to device ${deviceId} (normalized: ${normalizedRackId}):`,
				command,
				commandData
			);

			// Verify user authentication
			if (!socket.userId) {
				throw new Error("User not authenticated");
			}

			// For non-broadcast commands, verify device ownership
			if (command !== "broadcast" && deviceId !== "broadcast") {
				const device = await Device.findOne({ rackId: normalizedRackId }).populate(
					"owner"
				);
				if (!device) {
					throw new Error(`Device not found: ${normalizedRackId}`);
				}
				if (device.owner._id.toString() !== socket.userId.toString()) {
					throw new Error("Not authorized to control this device");
				}
			}

			// Get MQTT client from app settings
			const mqttClient = app.get("mqttClient");
			if (!mqttClient) {
				throw new Error("MQTT client not available");
			}

			// Determine MQTT topic based on command type
			let topic;
			let message;

			if (command === "broadcast") {
				// Broadcast command to all devices
				topic = `intellirack/broadcast/command`;
				message = JSON.stringify({
					command: commandData.broadcastCommand,
					...commandData,
				});
			} else {
				// Device-specific command - use normalized rackId
				topic = `intellirack/${normalizedRackId}/command`;
				// Always send plain string for nfc_write or write
				if (
					(command === "nfc_write" || command === "write") &&
					commandData.ingredient
				) {
					message = `write:${commandData.ingredient.trim()}`;
				} else if (command === "nfc_write" || command === "write") {
					// No ingredient provided
					socket.emit("commandSent", {
						deviceId,
						command,
						success: false,
						error: "No ingredient specified for NFC write.",
					});
					return;
				} else if (typeof command === "string" && !commandData.ingredient) {
					// For simple commands like "tare", "nfc_read", etc.
					message = command;
				} else {
					// Send as JSON for other commands
					message = JSON.stringify({ command, deviceId: normalizedRackId, ...commandData });
				}
			}

			console.log(`Publishing to MQTT topic: ${topic}`);
			console.log(`MQTT message: ${message}`);
			console.log(`Message type: ${typeof message}`);
			console.log(`Message length: ${message.length}`);
			console.log(
				`First character: '${message.charAt(0)}' (ASCII: ${message.charCodeAt(
					0
				)})`
			);
			console.log(
				`Target deviceId: ${deviceId} (normalized: ${normalizedRackId}), Command: ${command}, User: ${socket.userId}`
			);

			// Verify MQTT client exists before publishing
			if (!mqttClient.connected) {
				console.warn(`⚠️  MQTT client not connected! Status: ${mqttClient.connected}`);
				throw new Error("MQTT broker not connected");
			}

			mqttClient.publish(topic, message, { qos: 1, retain: false }, (publishErr) => {
				if (publishErr) {
					console.error(`❌ MQTT publish error for ${topic}:`, publishErr.message);
					socket.emit("commandSent", {
						deviceId: normalizedRackId,
						command,
						success: false,
						error: `MQTT publish failed: ${publishErr.message}`,
					});
				} else {
					console.log(`✅ MQTT message published successfully to ${topic}`);
					// Acknowledge command sent
					socket.emit("commandSent", { deviceId: normalizedRackId, command, success: true });
				}
			});
		} catch (error) {
			console.error("Command error:", error);
			socket.emit("commandSent", {
				deviceId: data.deviceId,
				command: data.command,
				success: false,
				error: error.message,
			});
		}
	});

	// Handle device discovery requests
	socket.on("discoverDevices", async (data) => {
		try {
			console.log("Device discovery requested");

			// For now, we'll implement a simple discovery mechanism
			// In a real implementation, you might scan the network for IntelliRack devices
			// or use mDNS discovery

			// Emit discovery results (placeholder)
			socket.emit("discoveryResults", {
				devices: [],
				message: "Device discovery completed",
			});
		} catch (error) {
			console.error("Discovery error:", error);
			socket.emit("discoveryResults", {
				devices: [],
				error: error.message,
			});
		}
	});

	// Handle test events from mobile app
	socket.on("test", async (data) => {
		console.log(
			`🧪 Test event received from ${socket.clientType || "unknown"} app:`,
			data
		);

		// Echo back the test event to confirm websocket is working
		socket.emit("test", {
			message: "Test response from server",
			timestamp: new Date().toISOString(),
			received: data,
		});

		// Also emit a test update event to verify the mobile app receives it
		const testUpdateData = {
			deviceId: data.deviceId,
			slotId: 1,
			ingredient: "Test Ingredient",
			weight: 250.5,
			status: "OK",
			isOnline: true,
			lastSeen: new Date(),
		};

		console.log("🧪 Emitting test update event:", testUpdateData);
		console.log(
			`🧪 Test - User: ${socket.userId}, Target room: user:${socket.userId}`
		);

		// Get current room members for detailed debugging
		if (socket.userId) {
			const roomSockets = await io.in(`user:${socket.userId}`).fetchSockets();
			console.log(
				`🧪 Room user:${socket.userId} has ${roomSockets.length} sockets:`
			);
			roomSockets.forEach((s) => {
				console.log(`   - Socket ${s.id} (${s.clientType || "unknown"})`);
			});

			io.to(`user:${socket.userId}`).emit("update", testUpdateData);
			io.to(`user:${socket.userId}`).emit("deviceStatus", testUpdateData);
		} else {
			// Fallback for unauthenticated sockets
			console.log("🧪 No userId, using global emit");
			io.emit("update", testUpdateData);
			io.emit("deviceStatus", testUpdateData);
		}
	});

	// Handle device registration requests
	socket.on("registerDevice", async (data) => {
		try {
			const { name, rackId, location, firmwareVersion, ipAddress, macAddress } =
				data;
			const normalizedRackId = normalizeRackId(rackId);
			const normalizedIpAddress = normalizeIpAddress(ipAddress);

			console.log("Device registration requested:", {
				name,
				rackId: normalizedRackId,
				location,
				ipAddress: normalizedIpAddress,
			});
			console.log("Socket user ID:", socket.userId);

			if (!normalizedRackId) {
				socket.emit("deviceRegistered", {
					success: false,
					error: "rackId is required",
				});
				return;
			}

			// Get user from socket (you might need to implement user authentication for sockets)
			// For now, we'll use a placeholder user ID
			const userId = socket.userId; // You'll need to set this during authentication

			if (!userId) {
				console.log("No user ID found in socket, using fallback");
				// For development, use a fallback user ID
				// In production, you should implement proper socket authentication
				const fallbackUser = await User.findOne();
				if (fallbackUser) {
					socket.userId = fallbackUser._id;
					console.log("Using fallback user:", fallbackUser._id);
				} else {
					socket.emit("deviceRegistered", {
						success: false,
						error: "User not authenticated and no fallback user found",
					});
					return;
				}
			}

			// Check if device already exists
			const existingDevice = await Device.findOne({ rackId: normalizedRackId });
			if (existingDevice) {
				console.log("Device already exists:", existingDevice._id);
				socket.emit("deviceRegistered", {
					success: false,
					error: "Device with this Rack ID already exists",
				});
				return;
			}

			// Create new device
			const device = new Device({
				name: name || `IntelliRack ${normalizedRackId}`,
				rackId: normalizedRackId,
				location: location || "Unknown",
				firmwareVersion: firmwareVersion || "v2.0",
				owner: socket.userId,
				ipAddress: normalizedIpAddress,
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
					mqttPublishInterval: 5000,
				},
				calibrationFactor: 204.99,
			});

			console.log("Saving device to database:", device);
			await device.save();
			console.log("Device saved successfully:", device._id);

			// Add device to user's devices array
			await User.findByIdAndUpdate(socket.userId, {
				$push: { devices: device._id },
			});
			console.log("Device added to user's devices array");

			console.log(
				`Device ${normalizedRackId} registered successfully for user ${socket.userId}`
			);

			socket.emit("deviceRegistered", {
				success: true,
				message: "Device registered successfully",
				device: device,
			});

			// Notify only the user who registered the device
			io.to(`user:${socket.userId}`).emit("deviceAdded", {
				deviceId: normalizedRackId,
				device: device,
			});
		} catch (error) {
			console.error("Registration error:", error);
			socket.emit("deviceRegistered", {
				success: false,
				error: error.message,
			});
		}
	});

	socket.on("disconnect", () => {
		console.log("Client disconnected:", socket.id);
		// Leave all rooms on disconnect
		if (socket.userId) {
			socket.leave(`user:${socket.userId}`);
		}
	});
});

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		version: "1.0.0",
	});
});

// Network info endpoint for device discovery
app.get("/api/network-info", (req, res) => {
	// Get client IP address
	const clientIP =
		req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

	// Extract base IP (first 3 octets)
	const baseIP = clientIP.split(".").slice(0, 3).join(".");

	res.json({
		clientIP,
		baseIP,
		timestamp: new Date().toISOString(),
	});
});

// Broadcast discovery endpoint for device discovery
app.post("/api/broadcast-discovery", async (req, res) => {
	try {
		const { action, timeout = 5000 } = req.body;

		if (action !== "discover") {
			return res.status(400).json({ error: "Invalid action" });
		}

		console.log("Broadcast discovery requested, timeout:", timeout);

		// For now, return empty array since we don't have active device scanning
		// In a real implementation, this could trigger network scanning or return cached devices
		res.json({
			devices: [],
			message: "Broadcast discovery completed",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Broadcast discovery error:", error);
		res.status(500).json({
			error: "Broadcast discovery failed",
			message: error.message,
		});
	}
});

// Test MQTT command endpoint
app.post("/test-mqtt", (req, res) => {
	try {
		const { deviceId, command, ...commandData } = req.body;
		const mqttClient = app.get("mqttClient");

		if (!mqttClient) {
			return res.status(500).json({ error: "MQTT client not available" });
		}

		const topic = `intellirack/${deviceId}/command`;
		const message = JSON.stringify({ command, deviceId, ...commandData });

		console.log(`Test MQTT - Topic: ${topic}`);
		console.log(`Test MQTT - Message: ${message}`);
		console.log(`Test MQTT - Command: ${command}`);
		console.log(`Test MQTT - CommandData:`, commandData);

		mqttClient.publish(topic, message, { qos: 1, retain: false }, (publishErr) => {
			if (publishErr) {
				console.error(`Test MQTT - Publish error for ${topic}:`, publishErr.message);
				return res.status(500).json({
					error: `MQTT publish failed: ${publishErr.message}`,
					topic,
					message,
					command,
				});
			}

			console.log(`Test MQTT - ✅ Message published successfully`);
			res.json({
				success: true,
				topic,
				message,
				command,
				commandData,
				timestamp: new Date().toISOString(),
			});
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Test WebSocket events endpoint
app.post("/test-events", (req, res) => {
	try {
		const { deviceId, eventType, data } = req.body;
		const io = app.get("io");

		if (!io) {
			return res.status(500).json({ error: "WebSocket not available" });
		}

		console.log(
			`Test Event - Type: ${eventType}, Device: ${deviceId}, Data:`,
			data
		);

		switch (eventType) {
			case "nfcEvent":
				io.emit("nfcEvent", { deviceId, ...data });
				break;
			case "commandResponse":
				io.emit("commandResponse", { deviceId, ...data });
				break;
			case "commandSent":
				io.emit("commandSent", { deviceId, ...data });
				break;
			default:
				return res.status(400).json({ error: "Unknown event type" });
		}

		res.json({
			success: true,
			eventType,
			deviceId,
			data,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

mongoose
	.connect(app.get("mongoURI"))
	.then(() => {
		console.log("✅ MongoDB connected");
		const mqttClient = setupMQTT(io);
		app.set("mqttClient", mqttClient); // Store MQTT client for command handling
		app.set("io", io); // Store io instance for event testing
		const bindHost = process.env.BIND_HOST || "0.0.0.0";
		server.listen(process.env.PORT, bindHost, () =>
			console.log(`🚀 Server running on http://${bindHost}:${process.env.PORT}`)
		);
	})
	.catch((err) => console.error("MongoDB Error:", err, app.get("mongoURI")));
