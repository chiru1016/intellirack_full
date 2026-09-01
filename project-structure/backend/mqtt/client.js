const mqtt = require("mqtt");
const {
	handleMQTTMessage,
	handleDeviceHeartbeat,
	startStatusMonitoring,
} = require("../controllers/mqttHandler");

function normalizePem(pem) {
	if (!pem || typeof pem !== "string") return undefined;
	const trimmed = pem.trim();
	const unquoted =
		trimmed.startsWith('"') && trimmed.endsWith('"')
			? trimmed.slice(1, -1)
			: trimmed;
	const normalized = unquoted.replace(/\\n/g, "\n");
	return normalized || undefined;
}

function resolveMqttProtocol(mqttUrl) {
	if (!mqttUrl) return { protocol: undefined, secure: false, websocket: false };

	let parsedProtocol;
	try {
		parsedProtocol = new URL(mqttUrl).protocol.replace(":", "");
	} catch (_) {
		parsedProtocol = mqttUrl.split(":")[0];
	}

	const protocol = String(parsedProtocol || "").toLowerCase();
	const secure = protocol === "mqtts" || protocol === "wss";
	const websocket = protocol === "ws" || protocol === "wss";

	return { protocol, secure, websocket };
}

function setupMQTT(io) {
	const mqttUrl = process.env.MQTT_URL;
	if (!mqttUrl) {
		throw new Error("Missing MQTT_URL. Set it in backend/.env before starting the server.");
	}

	const MQTT_CA = normalizePem(process.env.MQTT_CA);
	const tlsInsecure = String(process.env.MQTT_TLS_INSECURE || "false").toLowerCase() === "true";
	const { protocol, secure, websocket } = resolveMqttProtocol(mqttUrl);

	const mqttOptions = {
		clientId: `intellirack-server-${Date.now()}`,
		clean: true,
		reconnectPeriod: 5000,
		connectTimeout: 30000,
		keepalive: 60,
		resubscribe: true,
		reconnectOnConnackError: true,
	};

	// Add MQTT credentials from environment variables
	if (process.env.MQTT_USERNAME) {
		mqttOptions.username = process.env.MQTT_USERNAME;
	}
	if (process.env.MQTT_PASSWORD) {
		mqttOptions.password = process.env.MQTT_PASSWORD;
	}
	if (protocol) {
		mqttOptions.protocol = protocol;
	}

	if (secure) {
		mqttOptions.rejectUnauthorized = !tlsInsecure;
		if (MQTT_CA) {
			mqttOptions.ca = MQTT_CA;
		}
		mqttOptions.servername = process.env.MQTT_TLS_SERVERNAME || undefined;
	}

	if (websocket && !mqttOptions.path) {
		mqttOptions.path = process.env.MQTT_WS_PATH || "/mqtt";
	}

	console.log(`🔒 Connecting to MQTT broker: ${mqttUrl}`);
	console.log(
		`🔐 Protocol: ${secure ? `${protocol.toUpperCase()} (Secure)` : `${(protocol || "mqtt").toUpperCase()} (Insecure)`}`
	);
	if (secure) {
		console.log(`🔐 TLS mode: ${tlsInsecure ? "insecure (verification disabled)" : "strict"}`);
		console.log(
			`📜 Certificate source: ${MQTT_CA ? "Environment" : "System trust store"}`
		);
		if (mqttOptions.servername) {
			console.log(`🌐 TLS servername override: ${mqttOptions.servername}`);
		}
	}

	if (websocket) {
		console.log(`🌍 WebSocket path: ${mqttOptions.path}`);
	}

	const client = mqtt.connect(mqttUrl, mqttOptions);

	client.on("connect", () => {
		console.log("✅ MQTT connected to broker");
		const topics = [
			"intellirack/#",
			"intellirack/+/heartbeat",
			"intellirack/+/status",
			"intellirack/+/response",
			"intellirack/+/data",
			"intellirack/",
		];

		client.subscribe(topics, (subscribeErr) => {
			if (subscribeErr) {
				console.error("❌ MQTT subscribe error:", subscribeErr.message);
				return;
			}

			console.log("📡 Subscribed to MQTT topics:");
			topics.forEach((topic) => console.log(`  - ${topic}`));

			// Start device status monitoring after subscriptions succeed
			startStatusMonitoring(io);
		});
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
				await handleDeviceHeartbeat(deviceId, payload, io);
			} else if (topic.includes("/status")) {
				await handleDeviceHeartbeat(deviceId, payload, io);
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
				await handleMQTTMessage(correctedPayload, io);
			} else if (
				topic.includes("/weight") ||
				topic.includes("/data") ||
				topic === "intellirack/"
			) {
				// Weight/ingredient data - ensure deviceId consistency
				console.log(`📊 Processing weight data for device: ${deviceId}`);
				const correctedPayload = { ...payload, deviceId: deviceId };
				await handleMQTTMessage(correctedPayload, io);
			} else {
				// Default handling for other topics - ensure deviceId consistency
				console.log(`🔄 Processing other MQTT message for device: ${deviceId}`);
				const correctedPayload = { ...payload, deviceId: deviceId };
				await handleMQTTMessage(correctedPayload, io);
			}
		} catch (err) {
			console.error("❌ MQTT Error:", err.message);
			console.error("Topic:", topic);
			console.error("Message:", message.toString());
		}
	});

	client.on("error", (error) => {
		console.error("❌ MQTT Connection Error:", error);
		if (error && error.message === "connack timeout") {
			console.error(
				"⚠️ MQTT connack timeout: broker accepted TCP/TLS but did not return CONNACK in time. Check protocol (mqtt/mqtts/ws/wss), broker listener port, and credentials."
			);
		}
	});

	client.on("reconnect", () => {
		console.log("🔄 MQTT reconnecting...");
	});

	client.on("close", () => {
		console.log(`🔌 MQTT connection closed (connected=${client.connected})`);
	});

	client.on("offline", () => {
		console.log("📴 MQTT client offline");
	});

	return client;
}

module.exports = setupMQTT;
