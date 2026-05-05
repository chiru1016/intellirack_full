const mqtt = require("mqtt");
const {
	handleMQTTMessage,
	handleDeviceHeartbeat,
	startStatusMonitoring,
} = require("../controllers/mqttHandler");

function setupMQTT(io) {
	// CA Certificate from environment variable or fallback
	const MQTT_CA = process.env.MQTT_CA;

	const mqttOptions = {
		clientId: `intellirack-server-${Date.now()}`,
		clean: true,
		reconnectPeriod: 5000,
		connectTimeout: 30000,
		keepalive: 60,
	};

	// Add MQTT credentials from environment variables
	if (process.env.MQTT_USERNAME) {
		mqttOptions.username = process.env.MQTT_USERNAME;
	}
	if (process.env.MQTT_PASSWORD) {
		mqttOptions.password = process.env.MQTT_PASSWORD;
	}

	// Use secure MQTT URL from environment or fallback
	const mqttUrl = process.env.MQTT_URL;

	// Detect if we're using secure or insecure MQTT
	// Check both protocol prefix and port number
	const isSecure = mqttUrl.startsWith("mqtts://");
	// Only apply SSL options for secure connections
	if (isSecure) {
		mqttOptions.protocol = "mqtts";
		mqttOptions.rejectUnauthorized = false;
		mqttOptions.ca = MQTT_CA;
		mqttOptions.secureProtocol = "TLSv1_2_method";
		mqttOptions.checkServerIdentity = (hostname, cert) => {
			return hostname === "mqtt.judesonleo.app"
				? undefined
				: new Error("Hostname mismatch");
		};
	} else {
		// For insecure connections, remove SSL options
		delete mqttOptions.protocol;
		delete mqttOptions.rejectUnauthorized;
		delete mqttOptions.ca;
		delete mqttOptions.secureProtocol;
		delete mqttOptions.checkServerIdentity;
	}

	console.log(`🔒 Connecting to MQTT broker: ${mqttUrl}`);
	console.log(
		`🔐 Protocol: ${isSecure ? "MQTTS (Secure)" : "MQTT (Insecure)"}`
	);
	if (isSecure) {
		console.log(`🔐 Using CA certificate for: mqtt.judesonleo.app`);
		console.log(
			`📜 Certificate source: ${
				process.env.MQTT_CA ? "Environment" : "Fallback"
			}`
		);
		// console.log(MQTT_CA);
	}

	const client = mqtt.connect(mqttUrl, mqttOptions);

	client.on("connect", () => {
		console.log("✅ MQTT connected to broker");
		client.subscribe("intellirack/#");
		client.subscribe("intellirack/+/heartbeat");
		client.subscribe("intellirack/+/status");
		client.subscribe("intellirack/+/response");
		client.subscribe("intellirack/+/data");
		// Subscribe to weight data topic (devices publish to base "intellirack/" topic)
		client.subscribe("intellirack/");

		console.log("📡 Subscribed to MQTT topics:");
		console.log("  - intellirack/#");
		console.log("  - intellirack/+/heartbeat");
		console.log("  - intellirack/+/status");
		console.log("  - intellirack/+/response");
		console.log("  - intellirack/+/data");
		console.log("  - intellirack/");

		// Start device status monitoring
		startStatusMonitoring(io);
	});

	client.on("message", async (topic, message) => {
		try {
			const payload = JSON.parse(message.toString());

			// Extract device ID from topic or payload
			const topicParts = topic.split("/");
			let deviceId = topicParts[1];

			// Handle different topic structures
			if (topic === "intellirack/" || topic.startsWith("intellirack/#")) {
				// Weight data is published to base "intellirack/" topic
				// Use deviceId from payload instead
				deviceId = payload.deviceId;
			}

			console.log(
				`MQTT Message: Topic=${topic}, TopicDeviceId=${topicParts[1]}, PayloadDeviceId=${payload.deviceId}, FinalDeviceId=${deviceId}`
			);

			// Handle empty deviceId by trying to find device by IP address
			if (!deviceId || deviceId === "") {
				console.warn(
					`⚠️ Empty deviceId, attempting to find device by IP: ${payload.ipAddress}`
				);

				if (payload.ipAddress) {
					// Try to find device by IP address
					const Device = require("../models/Device");
					const deviceByIp = await Device.findOne({
						ipAddress: payload.ipAddress,
					});
					if (deviceByIp) {
						deviceId = deviceByIp.rackId;
						console.log(
							`✅ Found device by IP: ${payload.ipAddress} -> ${deviceId}`
						);
						// Update payload with correct deviceId
						payload.deviceId = deviceId;
					} else {
						console.warn(`❌ No device found with IP: ${payload.ipAddress}`);
						return;
					}
				} else {
					console.warn(`❌ No deviceId or IP address provided`);
					return;
				}
			}

			// Handle different message types
			if (topic.includes("/heartbeat")) {
				// await handleDeviceHeartbeat(deviceId, payload, io);
				handleDeviceHeartbeat(deviceId, payload, io);
			} else if (topic.includes("/status")) {
				// Device status update
				// await handleDeviceHeartbeat(deviceId, payload, io);
				handleDeviceHeartbeat(deviceId, payload, io);
			} else if (topic.includes("/response")) {
				// Command response from device
				console.log(`Command response from ${deviceId}:`, payload);

				// Find device to get owner for targeted emit
				const Device = require("../models/Device");
				// Use deviceId from topic, not payload, for consistent device identification
				const device = await Device.findOne({
					rackId: deviceId,
				}).populate("owner");

				if (device && device.owner) {
					console.log(
						`📡 Emitting command response to user ${device.owner._id} for device ${deviceId}`
					);

					// Emit command response event only to device owner with consistent deviceId
					io.to(`user:${device.owner._id}`).emit("commandResponse", {
						deviceId: device.rackId, // Use device.rackId for consistency with frontend
						command: payload.command,
						response: payload.response,
						message: payload.response,
						timestamp: payload.timestamp || new Date(),
						ingredient: payload.ingredient,
					});

					// Also emit specific NFC events for better frontend handling
					if (payload.command && payload.command.startsWith("nfc_")) {
						const nfcType = payload.command.replace("nfc_", "");
						console.log(
							`📡 Emitting NFC event (${nfcType}) to user ${device.owner._id} for device ${device.rackId}`
						);

						io.to(`user:${device.owner._id}`).emit("nfcEvent", {
							type: nfcType,
							deviceId: device.rackId, // Use device.rackId for consistency with frontend
							response: payload.response,
							message: payload.response || `NFC ${nfcType} completed`,
							timestamp: payload.timestamp || new Date(),
							ingredient: payload.ingredient,
							tagUID: payload.tagUID,
						});
					}

					// Emit command sent confirmation
					io.to(`user:${device.owner._id}`).emit("commandSent", {
						deviceId: device.rackId,
						command: payload.command,
						timestamp: new Date(),
					});
				}

				// Also send to mqttHandler for processing - ensure deviceId consistency
				const correctedPayload = { ...payload, deviceId: deviceId };
				handleMQTTMessage(correctedPayload, io);
			} else if (
				topic.includes("/weight") ||
				topic.includes("/data") ||
				topic === "intellirack/"
			) {
				// Weight/ingredient data - ensure deviceId consistency
				console.log(`📊 Processing weight data for device: ${deviceId}`);
				const correctedPayload = { ...payload, deviceId: deviceId };
				handleMQTTMessage(correctedPayload, io);
			} else {
				// Default handling for other topics - ensure deviceId consistency
				console.log(`🔄 Processing other MQTT message for device: ${deviceId}`);
				const correctedPayload = { ...payload, deviceId: deviceId };
				handleMQTTMessage(correctedPayload, io);
			}
		} catch (err) {
			console.error("❌ MQTT Error:", err.message);
			console.error("Topic:", topic);
			console.error("Message:", message.toString());
		}
	});

	client.on("error", (error) => {
		console.error("❌ MQTT Connection Error:", error);
	});

	client.on("reconnect", () => {
		console.log("🔄 MQTT reconnecting...");
	});

	client.on("close", () => {
		console.log("🔌 MQTT connection closed");
	});

	return client;
}

module.exports = setupMQTT;
