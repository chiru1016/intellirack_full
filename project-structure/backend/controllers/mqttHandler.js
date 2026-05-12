const Device = require("../models/Device");
const IngredientStatus = require("../models/IngredientStatus");
const IngredientLog = require("../models/IngredientLog");
const Alert = require("../models/Alert");
const NFCTag = require("../models/NFCTag");
const StockThreshold = require("../models/StockThreshold");
const BillingRecord = require("../models/BillingRecord");
const {
	isSupabaseEnabled,
	pushTelemetryBatch,
	upsertRackCurrentState,
} = require("../services/supabase");

if (typeof fetch === "undefined") {
	global.fetch = require("node-fetch");
}

// Configuration constants
const CONFIG = {
	OFFLINE_THRESHOLD: 5 * 60 * 1000, // 5 minutes
	STATUS_CHECK_INTERVAL: 2000, // 2 seconds
	MAX_INGREDIENT_LENGTH: 100,
	MIN_WEIGHT_CHANGE: 10, // grams
	MAX_WEIGHT: 20000, // 20kg
	IMPOSSIBLE_WEIGHT_CHANGE: 10000, // 10kg
	RESTOCK_THRESHOLD: 100, // grams
	BATCH_USAGE_THRESHOLD: 1000, // grams

	// NEW: Data optimization settings
	BATCH_WRITE_INTERVAL: 10000, // 10 seconds - batch database writes
	MIN_LOG_INTERVAL: 60 * 1000, // 1 minute - minimum time between logs
	WEIGHT_CHANGE_THRESHOLD: 50, // 50g - only log significant changes
	STATUS_CHANGE_THRESHOLD: 300 * 1000, // 5 minutes - status update frequency
	DAILY_AGGREGATION: true, // Enable daily data aggregation
	COMPRESSION_ENABLED: true, // Enable data compression for old records
	MAX_DAILY_LOGS: 24, // Maximum logs per day per ingredient (hourly)
	RETENTION_DAYS: 90, // Keep detailed logs for 90 days, then aggregate

	// NEW: Memory management settings
	MAX_BUFFER_SIZE: 1000, // Maximum items per buffer
	MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB max memory usage
	MEMORY_PRESSURE_THRESHOLD: 0.8, // 80% memory usage triggers flush
	EMERGENCY_FLUSH_THRESHOLD: 0.95, // 95% triggers emergency flush
	BUFFER_CLEANUP_INTERVAL: 30000, // 30 seconds - buffer cleanup check
};

// Device status tracking
const deviceStatus = new Map(); // Track last heartbeat for each device

// NEW: Batch write buffers with memory management
const batchBuffers = {
	ingredientLogs: new Map(), // deviceId_slotId -> array of logs
	ingredientStatus: new Map(), // deviceId_slotId -> latest status
	alerts: new Map(), // deviceId_slotId -> array of alerts
	auditLogs: new Map(), // deviceId -> array of audit logs

	// NEW: Memory management methods
	getTotalSize() {
		let total = 0;
		for (const [type, buffer] of Object.entries(this)) {
			if (type === "ingredientStatus") {
				total += buffer.size;
			} else if (buffer && typeof buffer.values === "function") {
				for (const items of buffer.values()) {
					total += items.length;
				}
			}
		}
		return total;
	},

	shouldFlush() {
		return this.getTotalSize() > CONFIG.MAX_BUFFER_SIZE;
	},

	shouldEmergencyFlush() {
		return this.getTotalSize() > CONFIG.MAX_BUFFER_SIZE * 2;
	},

	// NEW: Memory cleanup
	cleanup() {
		for (const [type, buffer] of Object.entries(this)) {
			if (type === "ingredientStatus") {
				// Keep only latest status for each key
				for (const [key, value] of buffer.entries()) {
					// Ensure timestamp is valid before comparison
					const timestamp = value.timestamp;
					if (timestamp && Date.now() - timestamp > 300000) {
						// 5 minutes old
						buffer.delete(key);
					}
				}
			} else if (buffer && typeof buffer.values === "function") {
				// Keep only recent items in arrays
				for (const [key, items] of buffer.entries()) {
					if (items.length > 100) {
						// Keep only last 100 items
						buffer.set(key, items.slice(-100));
					}
				}
			}
		}
	},

	// NEW: Get memory usage statistics
	getMemoryStats() {
		const stats = {
			totalItems: this.getTotalSize(),
			bufferDetails: {},
			memoryPressure: false,
			recommendation: "OK",
		};

		for (const [type, buffer] of Object.entries(this)) {
			if (type === "ingredientStatus") {
				stats.bufferDetails[type] = {
					size: buffer.size,
					type: "Map",
				};
			} else if (buffer && typeof buffer.values === "function") {
				let totalItems = 0;
				let maxItems = 0;
				for (const items of buffer.values()) {
					totalItems += items.length;
					maxItems = Math.max(maxItems, items.length);
				}
				stats.bufferDetails[type] = {
					totalItems,
					maxItems,
					keys: buffer.size,
					type: "Array",
				};
			} else {
				stats.bufferDetails[type] = {
					totalItems: 0,
					maxItems: 0,
					keys: 0,
					type: "Unknown",
				};
			}
		}

		// Check memory pressure
		if (
			stats.totalItems >
			CONFIG.MAX_BUFFER_SIZE * CONFIG.MEMORY_PRESSURE_THRESHOLD
		) {
			stats.memoryPressure = true;
			stats.recommendation = "FLUSH";
		}

		if (
			stats.totalItems >
			CONFIG.MAX_BUFFER_SIZE * CONFIG.EMERGENCY_FLUSH_THRESHOLD
		) {
			stats.recommendation = "EMERGENCY_FLUSH";
		}

		return stats;
	},
};

// NEW: Last write timestamps to prevent excessive logging
const lastWriteTimestamps = new Map(); // deviceId_slotId -> timestamp

// NEW: Data compression cache
const compressionCache = new Map(); // deviceId_slotId -> compressed data

// NEW: Supabase streaming buffers for every MQTT snapshot
const supabaseStreamBuffer = [];
const supabaseCurrentStateBuffer = new Map(); // rackId_slotId -> latest snapshot

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDeviceId(deviceId) {
	if (deviceId === undefined || deviceId === null) return "";
	return String(deviceId).trim().toLowerCase();
}

function normalizeIpAddress(ipAddress) {
	if (ipAddress === undefined || ipAddress === null) return "";
	return String(ipAddress).trim();
}

function getOwnerId(device) {
	if (!device || !device.owner) return null;
	if (typeof device.owner === "object" && device.owner._id) {
		return device.owner._id;
	}
	return device.owner;
}

async function getStockThresholdForEvent(device, ingredient, slotId) {
	const ownerId = getOwnerId(device);
	if (!ownerId) return null;

	let threshold = await StockThreshold.findOne({
		userId: ownerId,
		device: device._id,
		ingredient,
		slotId,
		isActive: true,
	});

	if (!threshold) {
		threshold = await StockThreshold.findOne({
			userId: ownerId,
			device: null,
			ingredient,
			slotId,
			isActive: true,
		});
	}

	return threshold;
}

async function createWarehouseBillingIfNeeded(device, slotId, ingredient, weight, alert, io) {
	try {
		const ownerId = getOwnerId(device);
		if (!ownerId) return null;
		const AuditLog = require("../models/AuditLog");

		const threshold = await getStockThresholdForEvent(device, ingredient, slotId);
		const autoBillEnabled = threshold ? threshold.autoBillEnabled !== false : true;
		if (!autoBillEnabled) return null;

		const existingBill = await BillingRecord.findOne({
			userId: ownerId,
			device: device._id,
			slotId,
		ingredient,
			status: "PENDING",
		});

		if (existingBill) return existingBill;

		const quantity = Math.max(1, Number(threshold?.reorderQuantity) || 1);
		const unitPrice = Number(threshold?.unitPrice) || 0;
		const totalAmount = Number((quantity * unitPrice).toFixed(2));
		const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

		const billingRecord = await BillingRecord.create({
			userId: ownerId,
			warehouse: threshold?.warehouse || undefined,
			device: device._id,
			alert: alert?._id,
			invoiceNumber,
			ingredient,
			slotId,
			quantity,
			unitPrice,
			totalAmount,
			currency: threshold?.currency || "USD",
			status: "PENDING",
			threshold: Number(threshold?.lowThreshold) || Number(device.weightThresholds?.low) || 100,
			triggeredWeight: typeof weight === "number" ? weight : 0,
			notes: "Auto-generated from low-stock event",
		});

		await AuditLog.create({
			user: ownerId,
			action: "warehouse_bill_created",
			details: {
				invoiceNumber,
				deviceId: device._id,
				deviceRackId: device.rackId,
				alertId: alert?._id,
				ingredient,
				slotId,
				quantity,
				totalAmount,
			},
			createdAt: new Date(),
		});

		io.to(`user:${ownerId}`).emit("warehouseBillCreated", {
			billingId: billingRecord._id,
			invoiceNumber,
			deviceId: device.rackId,
			ingredient,
			slotId,
			quantity,
			unitPrice,
			totalAmount,
			currency: billingRecord.currency,
			status: billingRecord.status,
			createdAt: billingRecord.createdAt,
		});

		return billingRecord;
	} catch (error) {
		console.error("Error creating warehouse billing:", error);
		return null;
	}
}

async function cancelWarehouseBilling(device, slotId, ingredient, status, io) {
	try {
		const ownerId = getOwnerId(device);
		if (!ownerId) return 0;
		const AuditLog = require("../models/AuditLog");

		const result = await BillingRecord.updateMany(
			{
				userId: ownerId,
				device: device._id,
				slotId,
				ingredient,
				status: "PENDING",
			},
			{
				status: "CANCELLED",
				cancelledAt: new Date(),
				notes: `Auto-cancelled after stock recovered to ${status}`,
			}
		);

		if ((result.modifiedCount || 0) > 0) {
			await AuditLog.create({
				user: ownerId,
				action: "warehouse_bill_cancelled",
				details: {
					deviceId: device._id,
					deviceRackId: device.rackId,
					ingredient,
					slotId,
					status,
				},
				createdAt: new Date(),
			});

			io.to(`user:${ownerId}`).emit("warehouseStockRecovered", {
				deviceId: device.rackId,
				ingredient,
				slotId,
				status,
			});
		}

		return result.modifiedCount || 0;
	} catch (error) {
		console.error("Error cancelling warehouse billing:", error);
		return 0;
	}
}

function parseBatchKey(batchKey) {
	const lastSeparatorIndex = String(batchKey).lastIndexOf("_");
	if (lastSeparatorIndex < 0) {
		return { rackId: String(batchKey), slotId: 1 };
	}

	const rackId = String(batchKey).slice(0, lastSeparatorIndex);
	const slotId = Number(String(batchKey).slice(lastSeparatorIndex + 1)) || 1;

	return { rackId, slotId };
}

function getSupabaseStreamKey(rackId, slotId) {
	return `${normalizeDeviceId(rackId)}_${Number(slotId) || 1}`;
}

function enqueueSupabaseSnapshot({
	rackId,
	slotId,
	ownerId,
	ingredient,
	tagUID,
	weight,
	status,
	timestamp,
	mongoDeviceId,
	ipAddress,
	isOnline = true,
}) {
	const normalizedRackId = normalizeDeviceId(rackId);
	const finalSlotId = Number(slotId) || 1;
	const eventTime = timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now());
	const streamKey = getSupabaseStreamKey(normalizedRackId, finalSlotId);
	const telemetryRow = {
		rack_id: normalizedRackId,
		slot_id: finalSlotId,
		owner_id: ownerId ? String(ownerId) : null,
		ingredient: ingredient || null,
		tag_uid: tagUID || null,
		weight_grams: typeof weight === "number" ? weight : null,
		status: status || null,
		event_time: eventTime,
		mongo_device_id: mongoDeviceId ? String(mongoDeviceId) : null,
		metadata: {
			source: "mqtt",
			ipAddress: ipAddress || null,
			isOnline,
		},
	};

	supabaseStreamBuffer.push(telemetryRow);
	supabaseCurrentStateBuffer.set(streamKey, {
		rack_id: normalizedRackId,
		slot_id: finalSlotId,
		owner_id: ownerId ? String(ownerId) : null,
		ingredient: ingredient || null,
		tag_uid: tagUID || null,
		weight_grams: typeof weight === "number" ? weight : null,
		status: status || null,
		event_time: eventTime,
		mongo_device_id: mongoDeviceId ? String(mongoDeviceId) : null,
		metadata: {
			source: "mqtt",
			ipAddress: ipAddress || null,
			isOnline,
		},
	});
}

function hasPendingSupabaseSnapshots() {
	return supabaseStreamBuffer.length > 0 || supabaseCurrentStateBuffer.size > 0;
}

async function findDeviceForMqtt({ deviceId, ipAddress, includeOwner = true }) {
	const normalizedDeviceId = normalizeDeviceId(deviceId);
	const normalizedIpAddress = normalizeIpAddress(ipAddress);
	const queryParts = [];

	if (normalizedDeviceId) {
		queryParts.push({ rackId: normalizedDeviceId });
		queryParts.push({
			rackId: new RegExp(`^${escapeRegex(normalizedDeviceId)}$`, "i"),
		});
	}

	if (normalizedIpAddress) {
		queryParts.push({ ipAddress: normalizedIpAddress });
	}

	if (queryParts.length === 0) return null;

	let query;
	if (queryParts.length === 1) {
		query = Device.findOne(queryParts[0]);
	} else {
		query = Device.findOne({ $or: queryParts });
	}

	if (includeOwner) {
		query = query.populate("owner");
	}

	return query;
}

// NEW: Memory monitoring
const memoryMonitor = {
	lastCheck: Date.now(),
	checkInterval: 10000, // 10 seconds

	shouldCheckMemory() {
		return Date.now() - this.lastCheck > this.checkInterval;
	},

	checkMemoryPressure() {
		const stats = batchBuffers.getMemoryStats();

		if (stats.recommendation === "EMERGENCY_FLUSH") {
			utils.logWithContext("warn", "Emergency memory flush required", stats);
			return "EMERGENCY";
		} else if (stats.recommendation === "FLUSH") {
			utils.logWithContext(
				"info",
				"Memory pressure detected, flushing buffers",
				stats
			);
			return "PRESSURE";
		}

		return "OK";
	},

	updateLastCheck() {
		this.lastCheck = Date.now();
	},
};

// Utility functions
const utils = {
	normalizeIngredient: (ingredient) => {
		if (!ingredient || typeof ingredient !== "string") return null;

		const cleanIngredient = ingredient.trim();

		// Validation checks
		if (
			cleanIngredient.length < 1 ||
			cleanIngredient.length > CONFIG.MAX_INGREDIENT_LENGTH
		) {
			return null;
		}

		// Check for non-printable characters
		if (/[^\x20-\x7E]/.test(cleanIngredient)) {
			return null;
		}

		// Check for suspicious patterns
		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{3,}/.test(cleanIngredient)) {
			return null;
		}

		// Normalize to title case
		return cleanIngredient
			.toLowerCase()
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	},

	validateWeight: (weight) => {
		if (typeof weight !== "number" || isNaN(weight)) return false;
		return weight >= 0 && weight <= CONFIG.MAX_WEIGHT;
	},

	logWithContext: (level, message, context = {}) => {
		const timestamp = new Date().toISOString();
		const contextStr =
			Object.keys(context).length > 0
				? ` | Context: ${JSON.stringify(context)}`
				: "";

		switch (level) {
			case "info":
				console.log(`[${timestamp}] INFO: ${message}${contextStr}`);
				break;
			case "warn":
				console.warn(`[${timestamp}] WARN: ${message}${contextStr}`);
				break;
			case "error":
				console.error(`[${timestamp}] ERROR: ${message}${contextStr}`);
				break;
			case "debug":
				console.debug(`[${timestamp}] DEBUG: ${message}${contextStr}`);
				break;
		}
	},

	// NEW: Check if we should log this data
	shouldLogData: (deviceId, slotId, weight, status, ingredient) => {
		const key = `${deviceId}_${slotId}`;
		const now = Date.now();
		const lastWrite = lastWriteTimestamps.get(key);

		// Always log if no previous write
		if (!lastWrite) return true;

		// Check time threshold
		if (now - lastWrite < CONFIG.MIN_LOG_INTERVAL) {
			return false;
		}

		// Check if this is a significant change
		const lastData = batchBuffers.ingredientStatus.get(key);
		if (lastData) {
			const weightChange = Math.abs((weight || 0) - (lastData.weight || 0));
			const statusChanged = status !== lastData.status;
			const ingredientChanged = ingredient !== lastData.ingredient;

			// Log if significant change
			if (
				weightChange > CONFIG.WEIGHT_CHANGE_THRESHOLD ||
				statusChanged ||
				ingredientChanged
			) {
				return true;
			}

			// Note: ANOMALY alerts are now handled in the main MQTT handler
			// to avoid scope issues with device object
		}

		return false;
	},

	// NEW: Add data to batch buffer
	addToBatchBuffer: (type, key, data) => {
		if (!batchBuffers[type].has(key)) {
			batchBuffers[type].set(key, []);
		}
		batchBuffers[type].get(key).push(data);
	},

	// NEW: Get batch buffer key
	getBatchKey: (deviceId, slotId) => `${deviceId}_${slotId}`,

	// NEW: Check if batch should be written
	shouldWriteBatch: () => {
		const now = Date.now();
		const lastBatchWrite = global.lastBatchWriteTime || 0;
		return (
			now - lastBatchWrite >= CONFIG.BATCH_WRITE_INTERVAL ||
			hasPendingSupabaseSnapshots()
		);
	},
};

// NEW: Batch write function with enhanced monitoring
async function writeBatchToDatabase() {
	const timer = performanceMonitor.startTimer("batch_write");

	try {
		const writePromises = [];
		const streamTelemetryRows = supabaseStreamBuffer.splice(0, supabaseStreamBuffer.length);
		const streamCurrentStateRows = Array.from(supabaseCurrentStateBuffer.values());
		supabaseCurrentStateBuffer.clear();

		// Record buffer sizes before writing
		for (const [type, buffer] of Object.entries(batchBuffers)) {
			if (type === "ingredientStatus") {
				performanceMonitor.recordBufferSize(type, buffer.size);
			} else if (buffer && typeof buffer.values === "function") {
				let totalSize = 0;
				for (const items of buffer.values()) {
					totalSize += items.length;
				}
				performanceMonitor.recordBufferSize(type, totalSize);
			} else {
				// Fallback for non-Map buffers
				performanceMonitor.recordBufferSize(type, 0);
			}
		}

		// Batch write ingredient logs
		for (const [key, logs] of batchBuffers.ingredientLogs.entries()) {
			if (logs.length > 0) {
				writePromises.push(
					circuitBreakers.database
						.execute(async () => {
							const startTime = Date.now();
							try {
								await IngredientLog.insertMany(logs);
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"ingredient_logs_insert",
									duration,
									true
								);

								utils.logWithContext("info", "Batch ingredient logs written", {
									key,
									count: logs.length,
								});
							} catch (error) {
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"ingredient_logs_insert",
									duration,
									false
								);
								throw error;
							}
						})
						.catch((error) => {
							utils.logWithContext(
								"error",
								"Failed to write batch ingredient logs",
								{
									key,
									error: error.message,
								}
							);
						})
				);
				batchBuffers.ingredientLogs.set(key, []);
			}
		}

		// Batch write ingredient status updates
		for (const [key, status] of batchBuffers.ingredientStatus.entries()) {
			if (status) {
				writePromises.push(
					circuitBreakers.database
						.execute(async () => {
							const startTime = Date.now();
							try {
								await IngredientStatus.findOneAndUpdate(
									{ device: status.deviceId, slotId },
									{
										user: status.userId,
										ingredient: status.ingredient,
										tagUID: status.tagUID,
										weight: status.weight,
										status: status.status,
										lastUpdated: status.timestamp,
										isOnline: true,
									},
									{ upsert: true, new: true }
								);
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"ingredient_status_update",
									duration,
									true
								);

								utils.logWithContext("debug", "Batch status update written", {
									key,
								});
							} catch (error) {
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"ingredient_status_update",
									duration,
									false
								);
								throw error;
							}
						})
						.catch((error) => {
							utils.logWithContext(
								"error",
								"Failed to write batch status update",
								{
									key,
									error: error.message,
								}
							);
						})
				);
			}
		}

		// Batch write alerts
		for (const [key, alerts] of batchBuffers.alerts.entries()) {
			if (alerts.length > 0) {
				writePromises.push(
					circuitBreakers.database
						.execute(async () => {
							const startTime = Date.now();
							try {
								// Process each alert individually to handle any validation issues
								for (const alert of alerts) {
									try {
										await Alert.create(alert);
									} catch (alertError) {
										utils.logWithContext(
											"warn",
											"Failed to create individual alert",
											{
												alertType: alert.type,
												ingredient: alert.ingredient,
												error: alertError.message,
											}
										);
										// Continue with other alerts
									}
								}

								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"alerts_insert",
									duration,
									true
								);

								utils.logWithContext("info", "Batch alerts written", {
									key,
									count: alerts.length,
								});
							} catch (error) {
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"alerts_insert",
									duration,
									false
								);
								throw error;
							}
						})
						.catch((error) => {
							utils.logWithContext("error", "Failed to write batch alerts", {
								key,
								error: error.message,
							});
						})
				);
				batchBuffers.alerts.set(key, []);
			}
		}

		// Batch write audit logs
		for (const [deviceId, auditLogs] of batchBuffers.auditLogs.entries()) {
			if (auditLogs.length > 0) {
				const AuditLog = require("../models/AuditLog");
				writePromises.push(
					circuitBreakers.database
						.execute(async () => {
							const startTime = Date.now();
							try {
								await AuditLog.insertMany(auditLogs);
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"audit_logs_insert",
									duration,
									true
								);

								utils.logWithContext("debug", "Batch audit logs written", {
									deviceId,
									count: auditLogs.length,
								});
							} catch (error) {
								const duration = Date.now() - startTime;
								performanceMonitor.recordDatabaseOperation(
									"audit_logs_insert",
									duration,
									false
								);
								throw error;
							}
						})
						.catch((error) => {
							utils.logWithContext(
								"error",
								"Failed to write batch audit logs",
								{
									deviceId,
									error: error.message,
								}
							);
						})
				);
				batchBuffers.auditLogs.set(deviceId, []);
			}
		}

		// Execute all writes in parallel
		if (writePromises.length > 0 || streamTelemetryRows.length > 0 || streamCurrentStateRows.length > 0) {
			await Promise.all(writePromises);
			if (writePromises.length > 0) {
				global.lastBatchWriteTime = Date.now();
			}
			utils.logWithContext("info", "Batch database write completed", {
				totalOperations: writePromises.length,
			});

			if (isSupabaseEnabled()) {
				try {
					const syncTasks = [];

						const telemetryRowsToSync = [...streamTelemetryRows];
						const currentStateRowsToSync = [...streamCurrentStateRows];

					if (telemetryRowsToSync.length > 0) {
						syncTasks.push(pushTelemetryBatch(telemetryRowsToSync));
					}

					if (currentStateRowsToSync.length > 0) {
						syncTasks.push(upsertRackCurrentState(currentStateRowsToSync));
					}

					if (syncTasks.length > 0) {
						await Promise.all(syncTasks);
						utils.logWithContext("info", "Supabase telemetry sync completed", {
							telemetryRows: telemetryRowsToSync.length,
							currentStateRows: currentStateRowsToSync.length,
						});
					}
				} catch (supabaseError) {
					utils.logWithContext("error", "Supabase telemetry sync failed", {
						error: supabaseError.message,
							telemetryRows: streamTelemetryRows.length,
							currentStateRows: streamCurrentStateRows.length,
					});
				}
			}
		}

		// Clean up buffers after successful write
		batchBuffers.cleanup();
	} catch (error) {
		utils.logWithContext("error", "Batch write failed", {
			error: error.message,
			stack: error.stack,
		});
	} finally {
		timer.stop();
	}
}

// NEW: Data compression for old records
async function compressOldData() {
	if (!CONFIG.COMPRESSION_ENABLED) return;

	try {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - CONFIG.RETENTION_DAYS);

		// Aggregate daily data for old records
		const aggregationPipeline = [
			{
				$match: {
					timestamp: { $lt: cutoffDate },
				},
			},
			{
				$group: {
					_id: {
						device: "$device",
						slotId: "$slotId",
						ingredient: "$ingredient",
						date: {
							$dateToString: {
								format: "%Y-%m-%d",
								date: "$timestamp",
							},
						},
					},
					minWeight: { $min: "$weight" },
					maxWeight: { $max: "$weight" },
					avgWeight: { $avg: "$weight" },
					count: { $sum: 1 },
					firstTimestamp: { $first: "$timestamp" },
					lastTimestamp: { $last: "$timestamp" },
					statuses: { $addToSet: "$status" },
				},
			},
			{
				$project: {
					device: "$_id.device",
					slotId: "$_id.slotId",
					ingredient: "$_id.ingredient",
					date: "$_id.date",
					minWeight: 1,
					maxWeight: 1,
					avgWeight: 1,
					count: 1,
					firstTimestamp: 1,
					lastTimestamp: 1,
					statuses: 1,
					compressed: true,
					compressedAt: new Date(),
				},
			},
		];

		// Create compressed records
		const compressedData = await IngredientLog.aggregate(aggregationPipeline);

		if (compressedData.length > 0) {
			// Store compressed data in a separate collection
			const CompressedIngredientLog = require("../models/CompressedIngredientLog");
			await CompressedIngredientLog.insertMany(compressedData);

			// Remove old detailed logs
			await IngredientLog.deleteMany({ timestamp: { $lt: cutoffDate } });

			utils.logWithContext("info", "Data compression completed", {
				compressedRecords: compressedData.length,
				cutoffDate: cutoffDate.toISOString(),
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Data compression failed", {
			error: error.message,
			stack: error.stack,
		});
	}
}

async function handleMQTTMessage(payload, io) {
	const timer = performanceMonitor.startTimer("mqtt_message_processing");

	const {
		deviceId: rawDeviceId,
		slotId: rawSlotId,
		tagUID,
		ingredient,
		weight,
		status,
		timestamp,
		command,
		response,
	} = payload;
	const deviceId = normalizeDeviceId(rawDeviceId);

	// Ensure slotId has a default value
	const slotId = rawSlotId || 1;

	try {
		// Record MQTT message
		performanceMonitor.recordMQTTMessage(true);

		// Validate required fields
		if (!deviceId) {
			utils.logWithContext("warn", "MQTT message missing deviceId", {
				payload,
				deviceIdFromPayload: payload.deviceId,
				ipAddress: payload.ipAddress,
			});
			performanceMonitor.recordMQTTMessage(false);
			return;
		}
	const slotId = rawSlotId || 1; // Default to slot 1 if not provided
		console.log(`🔍 Processing MQTT message for device: ${deviceId}`);

		// Find and update device
		const device = await findDeviceForMqtt({
			deviceId,
			ipAddress: payload.ipAddress,
			includeOwner: true,
		});
		if (!device) {
			utils.logWithContext("warn", "Device not registered", {
				deviceId,
				ipAddress: payload.ipAddress,
				payload,
			});
			performanceMonitor.recordMQTTMessage(false);
			return;
		}

		if (device.rackId !== deviceId) {
			utils.logWithContext("info", "MQTT device matched via fallback lookup", {
				payloadDeviceId: deviceId,
				registeredRackId: device.rackId,
				ipAddress: payload.ipAddress,
			});
		}

		// Update device status
		const now = new Date();
		const deviceUpdate = {
			isOnline: true,
			lastSeen: now,
			lastWeight: weight || 0,
			lastStatus: status || "UNKNOWN",
			mqttConnected: true,
		};

		// Update IP address if provided
		if (payload.ipAddress) {
			deviceUpdate.ipAddress = payload.ipAddress;
		}

		// Update firmware version if provided
		if (payload.firmwareVersion) {
			deviceUpdate.firmwareVersion = payload.firmwareVersion;
		}

		await Device.findByIdAndUpdate(device._id, deviceUpdate);

		// Track heartbeat
		deviceStatus.set(device.rackId, {
			lastHeartbeat: now.getTime(),
			deviceId: device.rackId,
			slotId,
			weight,
			status,
		});

		// Always queue a Supabase snapshot so the digital twin receives every update
		enqueueSupabaseSnapshot({
			rackId: device.rackId,
			slotId,
			ownerId: device.owner?._id,
			ingredient:
				typeof ingredient === "string" && ingredient.trim() !== ""
					? ingredient.trim()
					: null,
			tagUID: tagUID || null,
			weight,
			status: status || "UNKNOWN",
			timestamp: now,
			mongoDeviceId: device._id,
			ipAddress: payload.ipAddress,
			isOnline: true,
		});

		// Early return if no ingredient data
		if (
			!ingredient ||
			typeof ingredient !== "string" ||
			ingredient.trim() === ""
		) {
			// Still emit device status updates even without ingredient data - only to device owner
			io.to(`user:${device.owner._id}`).emit("update", {
				deviceId: device.rackId,
				slotId,
				ingredient: null,
				weight,
				status,
				isOnline: true,
				lastSeen: now,
				ipAddress: payload.ipAddress,
			});

			io.to(`user:${device.owner._id}`).emit("deviceStatus", {
				deviceId: device.rackId,
				isOnline: true,
				lastSeen: now,
				weight,
				status,
				ingredient: null,
			});

			if (hasPendingSupabaseSnapshots() && utils.shouldWriteBatch()) {
				await writeBatchToDatabase();
			}
			return;
		}

		// Validate and normalize ingredient name
		const finalIngredient = utils.normalizeIngredient(ingredient);
		if (!finalIngredient) {
			utils.logWithContext("warn", "Invalid ingredient name", {
				deviceId,
				ingredient,
				payload,
			});
			performanceMonitor.recordMQTTMessage(false);
			return;
		}

		utils.logWithContext("info", "Normalized ingredient name", {
			deviceId,
			original: ingredient,
			normalized: finalIngredient,
		});

		// Validate weight - allow negative values but log warnings
		if (typeof weight !== "number" || isNaN(weight)) {
			utils.logWithContext("warn", "Invalid weight value", {
				deviceId,
				weight,
				ingredient: finalIngredient,
			});
			performanceMonitor.recordMQTTMessage(false);
			return;
		}

		// Log warning for negative weights (sensor calibration issue)
		if (weight < 0) {
			utils.logWithContext(
				"warn",
				"Negative weight detected - sensor calibration issue",
				{
					deviceId,
					weight,
					ingredient: finalIngredient,
				}
			);
		}

		// Check if weight exceeds maximum limit and create OVERWEIGHT alert
		if (weight > CONFIG.MAX_WEIGHT) {
			utils.logWithContext("warn", "Weight exceeds maximum limit", {
				deviceId,
				weight,
				ingredient: finalIngredient,
				maxWeight: CONFIG.MAX_WEIGHT,
			});

			// Create OVERWEIGHT alert
			await createAlertBatch(
				device,
				slotId, // Use slotId directly since finalSlotId is defined later
				finalIngredient,
				"OVERWEIGHT",
				{
					weight,
					maxWeight: CONFIG.MAX_WEIGHT,
					reason: "Weight exceeds maximum limit",
				},
				now
			);
		}

		// NEW: Check if we should log this data
		const finalSlotId = slotId || 1; // Default to slot 1 if not provided

		// Ensure finalSlotId is valid
		if (typeof finalSlotId !== "number" || finalSlotId < 1) {
			utils.logWithContext("warn", "Invalid slotId, using default", {
				deviceId,
				originalSlotId: slotId,
				finalSlotId,
			});
			finalSlotId = 1;
		}

		// Log slotId handling for debugging
		utils.logWithContext("debug", "SlotId processing", {
			deviceId,
			originalSlotId: slotId,
			finalSlotId,
			ingredient: finalIngredient,
		});

		// Emit real-time updates
		const updateData = {
			deviceId,
			slotId: finalSlotId, // Use finalSlotId for consistency
			ingredient: finalIngredient,
			weight,
			status,
			isOnline: true,
			lastSeen: now,
			ipAddress: payload.ipAddress,
		};

		const statusData = {
			deviceId,
			isOnline: true,
			lastSeen: now,
			weight,
			status,
			ingredient: finalIngredient,
		};

		utils.logWithContext("info", "Emitting websocket updates", {
			deviceId,
			updateData,
			statusData,
			owner: device.owner._id,
			roomTarget: `user:${device.owner._id}`,
		});

		// Emit only to the device owner's room with consistent device ID
		console.log(
			`📡 Emitting update to room: user:${device.owner._id} for device: ${device.rackId} (topic deviceId: ${deviceId})`
		);
		console.log(
			`🔍 Device DB info: _id=${device._id}, rackId=${device.rackId}`
		);
		console.log(`Update data:`, JSON.stringify(updateData, null, 2));

		// Ensure we use the device.rackId for frontend consistency
		const consistentUpdateData = { ...updateData, deviceId: device.rackId };
		const consistentStatusData = { ...statusData, deviceId: device.rackId };

		// Log detailed emit information for debugging
		console.log(`📡 Emitting to room user:${device.owner._id}:`);
		console.log(`   - Event: update, deviceId: ${device.rackId}`);
		console.log(`   - Event: deviceStatus, deviceId: ${device.rackId}`);

		// Get room socket count for debugging
		io.in(`user:${device.owner._id}`)
			.fetchSockets()
			.then((sockets) => {
				console.log(
					`👥 Sockets in room user:${device.owner._id}: ${sockets.length}`
				);
				sockets.forEach((s) => console.log(`   - Socket: ${s.id}`));
			});

		io.to(`user:${device.owner._id}`).emit("update", consistentUpdateData);
		io.to(`user:${device.owner._id}`).emit(
			"deviceStatus",
			consistentStatusData
		);

		if (
			utils.shouldLogData(
				deviceId,
				finalSlotId,
				weight,
				status,
				finalIngredient
			)
		) {
			try {
				// Process ingredient data with batch buffering
				await processIngredientDataBatch(
					device,
					finalSlotId,
					finalIngredient,
					tagUID,
					weight,
					status,
					now,
					io
				);

				// Update last write timestamp
				const key = utils.getBatchKey(deviceId, finalSlotId);
				lastWriteTimestamps.set(key, Date.now());
			} catch (processError) {
				utils.logWithContext(
					"error",
					"Error processing ingredient data batch",
					{
						deviceId,
						ingredient: finalIngredient,
						error: processError.message,
						stack: processError.stack,
					}
				);
			}
		}

		// Handle command responses (including NFC and other commands)
		if (command && response) {
			utils.logWithContext("info", "Command response received", {
				deviceId: device.rackId,
				command,
				response,
			});

			// Emit general command response event only to device owner with consistent device ID
			console.log(
				`📡 Emitting command response to user ${device.owner._id} for device ${device.rackId}, command: ${command}`
			);

			io.to(`user:${device.owner._id}`).emit("commandResponse", {
				deviceId: device.rackId, // Use device.rackId for frontend consistency
				command: command,
				response: response,
				message: response || "Command completed",
				timestamp: new Date(),
			});

			// Handle NFC-specific events
			if (command.startsWith("nfc_")) {
				await handleNFCEvent(device, command, response, io);
			}
		}

		// NEW: Check if we should write batch to database
		if (utils.shouldWriteBatch()) {
			await writeBatchToDatabase();
		}

		// NEW: Check memory pressure and flush if needed
		if (memoryMonitor.shouldCheckMemory()) {
			const memoryStatus = memoryMonitor.checkMemoryPressure();
			if (memoryStatus === "EMERGENCY") {
				utils.logWithContext("warn", "Emergency memory flush triggered");
				await writeBatchToDatabase();
			} else if (memoryStatus === "PRESSURE") {
				utils.logWithContext(
					"info",
					"Memory pressure detected, scheduling flush"
				);
				setTimeout(() => writeBatchToDatabase(), 1000);
			}
			memoryMonitor.updateLastCheck();
		}
	} catch (error) {
		utils.logWithContext("error", "MQTT Handler Error", {
			deviceId,
			error: error.message,
			stack: error.stack,
		});
		performanceMonitor.recordMQTTMessage(false);
	} finally {
		timer.stop();
	}
}

// NEW: Batch processing function
async function processIngredientDataBatch(
	device,
	slotId,
	ingredient,
	tagUID,
	weight,
	status,
	timestamp,
	io
) {
	try {
		// Validate slotId parameter and provide default if invalid
		const validSlotId = typeof slotId === "number" && slotId >= 1 ? slotId : 1;
		if (validSlotId !== slotId) {
			utils.logWithContext("warn", "Invalid slotId, using default", {
				deviceId: device.rackId,
				originalSlotId: slotId,
				validSlotId,
			});
		}

		const key = utils.getBatchKey(device.rackId, validSlotId);

		// Get last log for comparison
		const lastLog = await IngredientLog.findOne({
			device: device._id,
			slotId: validSlotId,
		}).sort({ timestamp: -1 });

		let shouldLog = false;
		let logStatus = status;
		let eventType = null;
		let alertType = null;
		let alertDetails = null;

		if (!lastLog) {
			shouldLog = true;
		} else {
			const weightChanged =
				Math.abs((weight || 0) - (lastLog.weight || 0)) >
				CONFIG.MIN_WEIGHT_CHANGE;
			const statusChanged = status !== lastLog.status;
			const ingredientChanged = ingredient !== lastLog.ingredient;
			const slotChanged = validSlotId !== lastLog.slotId;

			shouldLog =
				weightChanged || statusChanged || ingredientChanged || slotChanged;

			// Detect anomalies
			if (
				Math.abs((weight || 0) - (lastLog.weight || 0)) >
				CONFIG.IMPOSSIBLE_WEIGHT_CHANGE
			) {
				logStatus = "SENSOR_ERROR";
				alertType = "SENSOR_ERROR";
				alertDetails = {
					reason: "Impossible weight change",
					weight,
					lastWeight: lastLog.weight,
					change: Math.abs((weight || 0) - (lastLog.weight || 0)),
				};
				shouldLog = true;
			}

			// Restock detection
			if ((weight || 0) - (lastLog.weight || 0) > CONFIG.RESTOCK_THRESHOLD) {
				eventType = "RESTOCK";
				alertType = "RESTOCK";
				alertDetails = {
					weight,
					lastWeight: lastLog.weight,
					added: (weight || 0) - (lastLog.weight || 0),
				};
				shouldLog = true;
			}

			// Batch usage detection
			if (
				(lastLog.weight || 0) - (weight || 0) >
				CONFIG.BATCH_USAGE_THRESHOLD
			) {
				eventType = "BATCH_USAGE";
				alertType = "BATCH_USAGE";
				alertDetails = {
					weight,
					lastWeight: lastLog.weight,
					used: (lastLog.weight || 0) - (weight || 0),
				};
				shouldLog = true;
			}
		}

		if (shouldLog) {
			// Add to batch buffer instead of immediate write
			const logData = {
				user: device.owner,
				device: device._id,
				ingredient: ingredient,
				tagUID,
				weight,
				status: logStatus,
				slotId: validSlotId,
				timestamp: timestamp,
			};

			utils.addToBatchBuffer("ingredientLogs", key, logData);

			// Update status in batch buffer
			batchBuffers.ingredientStatus.set(key, {
				deviceId: device._id,
				userId: device.owner,
				ingredient: ingredient,
				tagUID,
				weight,
				status: logStatus,
				timestamp: timestamp,
			});

			// Add audit log to batch buffer
			const auditLogData = {
				user: device.owner,
				action: "ingredient_log_created",
				details: {
					status: logStatus,
					eventType,
					ingredient,
					weight,
					slotId: validSlotId,
				},
				timestamp: timestamp,
			};

			utils.addToBatchBuffer("auditLogs", device.rackId, auditLogData);

			// Create alert if needed
			if (alertType) {
				await createAlertBatch(
					device,
					validSlotId,
					ingredient,
					alertType,
					alertDetails,
					timestamp
				);
			}
		}

		// Handle low stock alerts
		if (["LOW", "VLOW", "EMPTY"].includes(status)) {
			try {
				await handleLowStockAlertBatch(
					device,
					validSlotId, // Use validSlotId for consistency
					ingredient,
					status,
					io
				);
			} catch (alertError) {
				utils.logWithContext("error", "Error handling low stock alert", {
					deviceId: device.rackId,
					ingredient,
					status,
					error: alertError.message,
				});
			}
		}

		// Auto-resolve alerts when conditions improve
		if (["GOOD", "MODERATE"].includes(status)) {
			try {
				await autoResolveAlerts(device, validSlotId, ingredient, status, io); // Use validSlotId for consistency
			} catch (resolveError) {
				utils.logWithContext("error", "Error auto-resolving alerts", {
					deviceId: device.rackId,
					ingredient,
					status,
					error: resolveError.message,
				});
			}
		}
	} catch (error) {
		utils.logWithContext("error", "Error processing ingredient data batch", {
			deviceId: device.rackId,
			ingredient,
			error: error.message,
		});
	}
}

// Separate function for creating alerts
async function createAlert(
	device,
	slotId,
	ingredient,
	alertType,
	alertDetails,
	timestamp
) {
	try {
		const existingAlert = await Alert.findOne({
			userId: device.owner._id,
			device: device._id,
			slotId,
			ingredient: ingredient,
			type: alertType,
			acknowledged: false,
		});

		if (!existingAlert) {
			const alert = await Alert.create({
				userId: device.owner._id,
				device: device._id,
				ingredient: ingredient,
				slotId,
				type: alertType,
				acknowledged: false,
				createdAt: timestamp,
			});

			// Send webhook if configured
			await sendWebhook(
				device.owner._id,
				alertType,
				ingredient,
				device._id,
				slotId,
				alertDetails
			);

			// Audit log
			const AuditLog = require("../models/AuditLog");
			await AuditLog.create({
				user: device.owner._id,
				action: "alert_created",
				details: {
					alertId: alert._id,
					alertType,
					ingredient,
					slotId,
					alertDetails,
				},
				timestamp: timestamp,
			});

			utils.logWithContext("info", "Alert created", {
				alertType,
				ingredient,
				slotId,
				deviceId: device.rackId,
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Error creating alert", {
			alertType,
			ingredient,
			error: error.message,
		});
	}
}

// NEW: Batch processing function for creating alerts with deduplication
async function createAlertBatch(
	device,
	slotId,
	ingredient,
	alertType,
	alertDetails,
	timestamp
) {
	try {
		const finalSlotId = slotId || 1; // Default to slot 1
		const key = utils.getBatchKey(device.rackId, finalSlotId);

		// Check for ANY existing unacknowledged alert for this ingredient/device/slot
		const existingAlert = await Alert.findOne({
			userId: device.owner._id,
			device: device._id,
			slotId: finalSlotId,
			ingredient: ingredient,
			acknowledged: false,
		});

		// Only create alert if none exists or if it's a different type
		if (!existingAlert || existingAlert.type !== alertType) {
			// If there's an existing alert of different type, acknowledge it first
			if (existingAlert && existingAlert.type !== alertType) {
				await Alert.findByIdAndUpdate(existingAlert._id, {
					acknowledged: true,
					acknowledgedAt: new Date(),
				});
			}

			const alert = await Alert.create({
				userId: device.owner._id,
				device: device._id,
				ingredient: ingredient,
				slotId: finalSlotId,
				type: alertType,
				acknowledged: false,
				createdAt: timestamp,
			});

			// Add to batch buffer
			utils.addToBatchBuffer("alerts", key, alert);

			// Send webhook
			await sendWebhook(
				device.owner,
				alertType,
				ingredient,
				device._id,
				finalSlotId,
				alertDetails
			);

			// Audit log
			const auditLogData = {
				user: device.owner,
				action: "alert_created",
				details: {
					alertId: alert._id,
					alertType,
					ingredient,
					slotId: finalSlotId,
					alertDetails,
				},
				timestamp: timestamp,
			};
			utils.addToBatchBuffer("auditLogs", device.rackId, auditLogData);

			utils.logWithContext("info", "Alert created", {
				alertType,
				ingredient,
				slotId: finalSlotId,
				deviceId: device.rackId,
			});
		} else {
			utils.logWithContext("debug", "Alert already exists, skipping creation", {
				alertType,
				ingredient,
				slotId: finalSlotId,
				deviceId: device.rackId,
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Error creating alert batch", {
			alertType,
			ingredient,
			error: error.message,
		});
	}
}

// Consolidated function for handling low stock alerts with deduplication
async function handleLowStockAlertBatch(
	device,
	slotId,
	ingredient,
	status,
	io
) {
	try {
		const alertType = status === "EMPTY" ? "EMPTY" : "LOW_STOCK";
		let createdAlert = null;

		// Check for ANY existing unacknowledged alert for this ingredient/device/slot
		const existingAlert = await Alert.findOne({
			userId: device.owner._id,
			device: device._id,
			slotId,
			ingredient: ingredient,
			acknowledged: false,
		});

		// Only create alert if none exists or if status has changed significantly
		if (!existingAlert || existingAlert.type !== alertType) {
			// If there's an existing alert of different type, acknowledge it first
			if (existingAlert && existingAlert.type !== alertType) {
				await Alert.findByIdAndUpdate(existingAlert._id, {
					acknowledged: true,
					acknowledgedAt: new Date(),
				});
			}

			createdAlert = await Alert.create({
				userId: device.owner._id,
				device: device._id,
				ingredient: ingredient,
				slotId,
				type: alertType,
				acknowledged: false,
				createdAt: new Date(),
			});

			// Add to batch buffer
			const key = utils.getBatchKey(device.rackId, slotId);
			utils.addToBatchBuffer("alerts", key, createdAlert);

			utils.logWithContext("info", "Low stock alert created", {
				alertType,
				ingredient,
				slotId,
				deviceId: device.rackId,
			});

			// Emit alert only to device owner
			io.to(`user:${device.owner._id}`).emit("alert", {
				deviceId: device.rackId,
				slotId,
				ingredient: ingredient,
				status,
			});

		}

			await createWarehouseBillingIfNeeded(
				device,
				slotId,
				ingredient,
				null,
				createdAlert || existingAlert || null,
				io
			);
	} catch (error) {
		utils.logWithContext("error", "Error handling low stock alert batch", {
			alertType: status,
			ingredient,
			error: error.message,
		});
	}
}

// Auto-resolve alerts when conditions improve
async function autoResolveAlerts(device, slotId, ingredient, status, io) {
	try {
		// Find and resolve any active alerts for this ingredient/device/slot
		const resolvedAlerts = await Alert.updateMany(
			{
				userId: device.owner._id,
				device: device._id,
				slotId,
				ingredient: ingredient,
				acknowledged: false,
				type: { $in: ["LOW_STOCK", "EMPTY", "OVERWEIGHT", "SENSOR_ERROR"] },
			},
			{
				acknowledged: true,
				acknowledgedAt: new Date(),
				resolvedBy: "system",
				resolvedReason: `Conditions improved to ${status}`,
			}
		);

		if (resolvedAlerts.modifiedCount > 0) {
			await cancelWarehouseBilling(device, slotId, ingredient, status, io);

			utils.logWithContext("info", "Auto-resolved alerts", {
				deviceId: device.rackId,
				slotId,
				ingredient,
				status,
				resolvedCount: resolvedAlerts.modifiedCount,
			});

			// Create audit log for auto-resolution
			const auditLogData = {
				user: device.owner,
				action: "alerts_auto_resolved",
				details: {
					deviceId: device._id,
					slotId,
					ingredient,
					status,
					resolvedCount: resolvedAlerts.modifiedCount,
				},
				timestamp: new Date(),
			};
			utils.addToBatchBuffer("auditLogs", device.rackId, auditLogData);
		}
	} catch (error) {
		utils.logWithContext("error", "Error auto-resolving alerts", {
			deviceId: device.rackId,
			ingredient,
			error: error.message,
		});
	}
}

// Separate function for sending webhooks with circuit breaker
async function sendWebhook(
	userId,
	alertType,
	ingredient,
	deviceId,
	slotId,
	alertDetails
) {
	try {
		const User = require("../models/User");
		const user = await User.findById(userId);

		if (user && user.webhookUrl) {
			// Use circuit breaker for webhook calls
			await circuitBreakers.webhook.execute(async () => {
				const response = await fetch(user.webhookUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						alertType,
						ingredient,
						device: deviceId,
						slotId,
						alertDetails,
						user: userId,
						timestamp: new Date().toISOString(),
					}),
				});

				if (!response.ok) {
					throw new Error(`Webhook failed with status: ${response.status}`);
				}

				return response;
			});

			utils.logWithContext("info", "Webhook sent successfully", {
				alertType,
				ingredient,
				webhookUrl: user.webhookUrl,
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Webhook error", {
			webhookUrl: undefined,
			error: error.message,
		});

		// Don't throw error - circuit breaker will handle retries
		// Just log the failure for monitoring
	}
}

// Handle NFC events
async function handleNFCEvent(device, command, response, io) {
	try {
		switch (command) {
			case "nfc_read":
				// Parse NFC read response
				try {
					const nfcData = JSON.parse(response);
					if (nfcData.tagPresent && nfcData.tagUID) {
						// Find or create NFC tag
						let tag = await NFCTag.findByUID(nfcData.tagUID);

						if (tag) {
							// Update existing tag
							await tag.incrementReadCount();

							// Update ingredient status
							await IngredientStatus.findOneAndUpdate(
								{ device: device._id, slotId: tag.slotId },
								{
									ingredient: nfcData.ingredient || tag.ingredient,
									tagUID: nfcData.tagUID,
									lastUpdated: new Date(),
									isOnline: true,
								},
								{ upsert: true, new: true }
							);
						}

						// Emit NFC read event
						io.to(`user:${device.owner._id}`).emit("nfcEvent", {
							type: "read",
							deviceId: device.rackId,
							tagUID: nfcData.tagUID,
							ingredient: nfcData.ingredient,
							response: `Tag read: ${nfcData.ingredient || "Unknown"}`,
							message: `NFC tag read successfully`,
							timestamp: new Date(),
						});

						utils.logWithContext("info", "NFC tag read", {
							deviceId: device.rackId,
							tagUID: nfcData.tagUID,
							ingredient: nfcData.ingredient,
						});
					}
				} catch (parseError) {
					utils.logWithContext("error", "Error parsing NFC read response", {
						deviceId: device.rackId,
						response,
						error: parseError.message,
					});
				}
				break;

			case "nfc_write":
			case "write":
				// Handle NFC write response
				io.to(`user:${device.owner._id}`).emit("nfcEvent", {
					type: "write",
					deviceId: device.rackId,
					response: response,
					message: response || "NFC tag written successfully",
					timestamp: new Date(),
				});
				utils.logWithContext("info", "NFC tag write", {
					deviceId: device.rackId,
					response,
				});
				break;

			case "nfc_clear":
			case "clear":
				// Handle NFC clear response
				io.to(`user:${device.owner._id}`).emit("nfcEvent", {
					type: "clear",
					deviceId: device.rackId,
					response: response,
					message: response || "NFC tag cleared successfully",
					timestamp: new Date(),
				});
				utils.logWithContext("info", "NFC tag clear", {
					deviceId: device.rackId,
					response,
				});
				break;

			case "nfc_format":
			case "format":
				// Handle NFC format response
				io.to(`user:${device.owner._id}`).emit("nfcEvent", {
					type: "format",
					deviceId: device.rackId,
					response: response,
					message: response || "NFC tag formatted successfully",
					timestamp: new Date(),
				});
				utils.logWithContext("info", "NFC tag format", {
					deviceId: device.rackId,
					response,
				});
				break;

			case "nfc_removed":
				// Handle NFC tag removal
				io.to(`user:${device.owner._id}`).emit("nfcEvent", {
					type: "removed",
					deviceId: device.rackId,
					response: "NFC tag removed",
					message: "NFC tag is no longer present",
					timestamp: new Date(),
				});
				utils.logWithContext("info", "NFC tag removed", {
					deviceId: device.rackId,
				});
				break;

			default:
				// Handle other commands
				io.to(`user:${device.owner._id}`).emit("commandResponse", {
					deviceId: device.rackId,
					command: command,
					response: response,
					message: response || "Command completed",
					success: true, // Default to success for unknown commands
					timestamp: new Date(),
				});
				utils.logWithContext("info", "Unknown NFC command", {
					deviceId: device.rackId,
					command,
					response,
				});
		}
	} catch (error) {
		utils.logWithContext("error", "NFC Event Handler Error", {
			deviceId: device.rackId,
			command,
			error: error.message,
			stack: error.stack,
		});
	}
}

// Handle device heartbeat/ping
async function handleDeviceHeartbeat(deviceId, payload, io) {
	try {
		const normalizedDeviceId = normalizeDeviceId(deviceId);
		if (!normalizedDeviceId) {
			utils.logWithContext("warn", "Heartbeat missing deviceId", { payload });
			return;
		}

		const device = await findDeviceForMqtt({
			deviceId: normalizedDeviceId,
			ipAddress: payload.ipAddress,
			includeOwner: true,
		});
		if (!device) {
			utils.logWithContext("warn", "Heartbeat from unregistered device", {
				deviceId: normalizedDeviceId,
				ipAddress: payload.ipAddress,
				payload,
			});
			return;
		}

		const now = new Date();
		await Device.findByIdAndUpdate(device._id, {
			isOnline: true,
			lastSeen: now,
			mqttConnected: true,
		});

		deviceStatus.set(device.rackId, {
			lastHeartbeat: now.getTime(),
			deviceId: device.rackId,
			...payload,
		});

		// Emit heartbeat status only to device owner with consistent device ID
		if (device.owner) {
			io.to(`user:${device.owner._id}`).emit("deviceStatus", {
				deviceId: device.rackId, // Use device.rackId for frontend consistency
				isOnline: true,
				lastSeen: now,
				weight: payload.weight,
				status: payload.status,
				ipAddress: payload.ipAddress,
			});
		}

		utils.logWithContext("debug", "Device heartbeat received", {
			deviceId: device.rackId,
			timestamp: now.toISOString(),
		});
	} catch (error) {
		utils.logWithContext("error", "Heartbeat Handler Error", {
			deviceId: normalizeDeviceId(deviceId),
			error: error.message,
			stack: error.stack,
		});
	}
}

// Check for offline devices
async function checkDeviceStatus(io) {
	const now = Date.now();

	for (const [deviceId, status] of deviceStatus.entries()) {
		if (now - status.lastHeartbeat > CONFIG.OFFLINE_THRESHOLD) {
			try {
				const device = await Device.findOne({ rackId: deviceId });
				if (device && device.isOnline) {
					await Device.findByIdAndUpdate(device._id, {
						isOnline: false,
						mqttConnected: false,
					});

					// Find device to get owner for targeted emit
					const deviceWithOwner = await Device.findOne({
						rackId: deviceId,
					}).populate("owner");
					if (deviceWithOwner && deviceWithOwner.owner) {
						io.to(`user:${deviceWithOwner.owner._id}`).emit("deviceStatus", {
							deviceId: deviceWithOwner.rackId, // Use device.rackId for frontend consistency
							isOnline: false,
							lastSeen: deviceWithOwner.lastSeen,
							offlineReason: "Heartbeat timeout",
						});
					}

					// Create OFFLINE alert
					await createOfflineAlert(device, io);

					utils.logWithContext("warn", "Device marked as offline", {
						deviceId,
						lastSeen: device.lastSeen,
					});
				}
			} catch (error) {
				utils.logWithContext("error", "Status Check Error - Offline", {
					deviceId,
					error: error.message,
				});
			}
		} else {
			// Check if device was offline and is now back online
			try {
				const device = await Device.findOne({ rackId: deviceId });
				if (device && !device.isOnline) {
					await Device.findByIdAndUpdate(device._id, {
						isOnline: true,
						mqttConnected: true,
						lastSeen: new Date(),
					});

					// Find device to get owner for targeted emit
					const deviceWithOwner = await Device.findOne({
						rackId: deviceId,
					}).populate("owner");
					if (deviceWithOwner && deviceWithOwner.owner) {
						io.to(`user:${deviceWithOwner.owner._id}`).emit("deviceStatus", {
							deviceId: deviceWithOwner.rackId, // Use device.rackId for frontend consistency
							isOnline: true,
							lastSeen: new Date(),
							restoreReason: "Heartbeat restored",
						});
					}

					// Create ONLINE alert
					await createOnlineAlert(device, io);

					utils.logWithContext("info", "Device marked as online", {
						deviceId,
						timestamp: new Date().toISOString(),
					});
				}
			} catch (error) {
				utils.logWithContext("error", "Status Check Error - Online", {
					deviceId,
					error: error.message,
				});
			}
		}
	}
}

// Create offline alert
async function createOfflineAlert(device, io) {
	try {
		const Alert = require("../models/Alert");
		const User = require("../models/User");
		const AuditLog = require("../models/AuditLog");

		const existing = await Alert.findOne({
			userId: device.owner,
			device: device._id,
			type: "OFFLINE",
			acknowledged: false,
		});

		if (!existing) {
			await Alert.create({
				userId: device.owner,
				device: device._id,
				type: "OFFLINE",
				acknowledged: false,
				createdAt: new Date(),
			});

			// Send webhook
			await sendWebhook(device.owner, "OFFLINE", null, device._id, null, {
				reason: "Device stopped responding to heartbeats",
				lastSeen: device.lastSeen,
			});

			// Audit log
			await AuditLog.create({
				user: device.owner,
				action: "device_offline_alert_created",
				details: { device: device._id },
				timestamp: new Date(),
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Error creating offline alert", {
			deviceId: device.rackId,
			error: error.message,
		});
	}
}

// Create online alert
async function createOnlineAlert(device, io) {
	try {
		const Alert = require("../models/Alert");
		const User = require("../models/User");
		const AuditLog = require("../models/AuditLog");

		const existing = await Alert.findOne({
			userId: device.owner,
			device: device._id,
			type: "ONLINE",
			acknowledged: false,
		});

		if (!existing) {
			await Alert.create({
				userId: device.owner,
				device: device._id,
				type: "ONLINE",
				acknowledged: false,
				createdAt: new Date(),
			});

			// Send webhook
			await sendWebhook(device.owner, "ONLINE", null, device._id, null, {
				reason: "Device resumed responding to heartbeats",
				timestamp: new Date().toISOString(),
			});

			// Audit log
			await AuditLog.create({
				user: device.owner,
				action: "device_online_alert_created",
				details: { device: device._id },
				timestamp: new Date(),
			});
		}
	} catch (error) {
		utils.logWithContext("error", "Error creating online alert", {
			deviceId: device.rackId,
			error: error.message,
		});
	}
}

// Start periodic status checking
function startStatusMonitoring(io) {
	utils.logWithContext("info", "Starting device status monitoring", {
		interval: CONFIG.STATUS_CHECK_INTERVAL,
		offlineThreshold: CONFIG.OFFLINE_THRESHOLD,
	});

	setInterval(() => checkDeviceStatus(io), CONFIG.STATUS_CHECK_INTERVAL);

	// NEW: Start batch write scheduler
	setInterval(async () => {
		if (utils.shouldWriteBatch() || hasPendingSupabaseSnapshots()) {
			await writeBatchToDatabase();
		}
	}, CONFIG.BATCH_WRITE_INTERVAL);

	// NEW: Start data compression scheduler (daily at 2 AM)
	setInterval(async () => {
		const now = new Date();
		if (now.getHours() === 2 && now.getMinutes() === 0) {
			utils.logWithContext("info", "Starting scheduled data compression");
			await compressOldData();
		}
	}, 60 * 1000); // Check every minute

	// NEW: Start cleanup scheduler (weekly on Sunday at 3 AM)
	setInterval(async () => {
		const now = new Date();
		if (now.getDay() === 0 && now.getHours() === 3 && now.getMinutes() === 0) {
			utils.logWithContext("info", "Starting scheduled cleanup tasks");
			await performCleanupTasks();
		}
	}, 60 * 1000); // Check every minute
}

// NEW: Cleanup tasks
async function performCleanupTasks() {
	try {
		// Clean up old alerts (older than 30 days)
		const alertCutoff = new Date();
		alertCutoff.setDate(alertCutoff.getDate() - 30);

		const deletedAlerts = await Alert.deleteMany({
			createdAt: { $lt: alertCutoff },
			acknowledged: true,
		});

		// Clean up old audit logs (older than 60 days)
		const auditCutoff = new Date();
		auditCutoff.setDate(auditCutoff.getDate() - 60);

		const deletedAuditLogs = await AuditLog.deleteMany({
			timestamp: { $lt: auditCutoff },
		});

		// Clean up old compressed logs (older than 1 year)
		const compressedCutoff = new Date();
		compressedCutoff.setFullYear(compressedCutoff.getFullYear() - 1);

		const CompressedIngredientLog = require("../models/CompressedIngredientLog");
		const deletedCompressed = await CompressedIngredientLog.deleteMany({
			compressedAt: { $lt: compressedCutoff },
		});

		utils.logWithContext("info", "Cleanup tasks completed", {
			deletedAlerts: deletedAlerts.deletedCount,
			deletedAuditLogs: deletedAuditLogs.deletedCount,
			deletedCompressed: deletedCompressed.deletedCount,
		});
	} catch (error) {
		utils.logWithContext("error", "Cleanup tasks failed", {
			error: error.message,
			stack: error.stack,
		});
	}
}

// NEW: Force batch write (for graceful shutdown)
async function forceBatchWrite() {
	utils.logWithContext("info", "Forcing batch write before shutdown");
	await writeBatchToDatabase();
}

// NEW: Get database statistics
async function getDatabaseStats() {
	try {
		const stats = {
			ingredientLogs: await IngredientLog.countDocuments(),
			ingredientStatus: await IngredientStatus.countDocuments(),
			alerts: await Alert.countDocuments(),
			auditLogs: await AuditLog.countDocuments(),
			compressedLogs: 0,
			batchBufferSizes: {
				ingredientLogs: 0,
				ingredientStatus: 0,
				alerts: 0,
				auditLogs: 0,
			},
			alertStats: {
				total: await Alert.countDocuments(),
				active: await Alert.countDocuments({ acknowledged: false }),
				acknowledged: await Alert.countDocuments({ acknowledged: true }),
				byType: await Alert.aggregate([
					{ $group: { _id: "$type", count: { $sum: 1 } } },
				]),
				recent: await Alert.countDocuments({
					createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
				}),
			},
		};

		// Count compressed logs if collection exists
		try {
			const CompressedIngredientLog = require("../models/CompressedIngredientLog");
			stats.compressedLogs = await CompressedIngredientLog.countDocuments();
		} catch (error) {
			// Collection doesn't exist yet
		}

		// Count batch buffer sizes
		for (const [type, buffer] of Object.entries(batchBuffers)) {
			if (type === "ingredientStatus") {
				stats.batchBufferSizes[type] = buffer.size;
			} else if (buffer && typeof buffer.values === "function") {
				let totalSize = 0;
				for (const items of buffer.values()) {
					totalSize += items.length;
				}
				stats.batchBufferSizes[type] = totalSize;
			} else {
				stats.batchBufferSizes[type] = 0;
			}
		}

		return stats;
	} catch (error) {
		utils.logWithContext("error", "Failed to get database stats", {
			error: error.message,
		});
		return null;
	}
}

// NEW: Reset batch buffers (for testing/debugging)
function resetBatchBuffers() {
	for (const [type, buffer] of Object.entries(batchBuffers)) {
		if (type === "ingredientStatus") {
			buffer.clear();
		} else if (buffer && typeof buffer.values === "function") {
			for (const key of buffer.keys()) {
				buffer.set(key, []);
			}
		}
	}
	lastWriteTimestamps.clear();
	global.lastBatchWriteTime = 0;

	utils.logWithContext("info", "Batch buffers reset");
}

// Graceful shutdown function
function stopStatusMonitoring() {
	utils.logWithContext("info", "Stopping device status monitoring");
	// Note: In a production environment, you'd want to properly clear the interval
	// This would require storing the interval ID and clearing it
}

// NEW: Circuit breaker for webhooks and external APIs
class CircuitBreaker {
	constructor(failureThreshold = 5, timeout = 60000, name = "default") {
		this.failureThreshold = failureThreshold;
		this.timeout = timeout;
		this.name = name;
		this.failureCount = 0;
		this.lastFailureTime = 0;
		this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
		this.successCount = 0;
		this.totalRequests = 0;
	}

	async execute(operation) {
		this.totalRequests++;

		if (this.state === "OPEN") {
			if (Date.now() - this.lastFailureTime > this.timeout) {
				this.state = "HALF_OPEN";
				utils.logWithContext(
					"info",
					`Circuit breaker ${this.name} transitioning to HALF_OPEN`
				);
			} else {
				utils.logWithContext(
					"warn",
					`Circuit breaker ${this.name} is OPEN, rejecting request`
				);
				throw new Error(`Circuit breaker ${this.name} is OPEN`);
			}
		}

		try {
			const result = await operation();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure();
			throw error;
		}
	}

	onSuccess() {
		this.failureCount = 0;
		this.successCount++;
		this.state = "CLOSED";
	}

	onFailure() {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.failureCount >= this.failureThreshold) {
			this.state = "OPEN";
			utils.logWithContext(
				"warn",
				`Circuit breaker ${this.name} opened after ${this.failureCount} failures`
			);
		}
	}

	getStats() {
		return {
			name: this.name,
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			totalRequests: this.totalRequests,
			lastFailureTime: this.lastFailureTime,
			failureRate:
				this.totalRequests > 0
					? (this.failureCount / this.totalRequests) * 100
					: 0,
			successRate:
				this.totalRequests > 0
					? (this.successCount / this.totalRequests) * 100
					: 0,
		};
	}

	reset() {
		this.failureCount = 0;
		this.successCount = 0;
		this.state = "CLOSED";
		this.lastFailureTime = 0;
		utils.logWithContext("info", `Circuit breaker ${this.name} reset`);
	}
}

// Initialize circuit breakers for different services
const circuitBreakers = {
	webhook: new CircuitBreaker(3, 30000, "webhook"), // 3 failures, 30s timeout
	externalAPI: new CircuitBreaker(5, 60000, "externalAPI"), // 5 failures, 60s timeout
	database: new CircuitBreaker(10, 120000, "database"), // 10 failures, 2min timeout
};

// NEW: Comprehensive performance monitoring
class PerformanceMonitor {
	constructor() {
		this.metrics = {
			processingTimes: [],
			bufferSizes: [],
			databaseOperations: [],
			errorRates: [],
			memoryUsage: [],
			mqttMessages: { total: 0, processed: 0, failed: 0 },
			circuitBreakers: {},
		};
		this.alerts = [];
		this.startTime = Date.now();
	}

	startTimer(operation) {
		const startTime = process.hrtime.bigint();
		return {
			operation,
			startTime,
			stop: () => this.stopTimer(operation, startTime, process.hrtime.bigint()),
		};
	}

	stopTimer(operation, startTime, endTime) {
		const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
		this.metrics.processingTimes.push({
			operation,
			duration,
			timestamp: new Date(),
		});

		// Keep only last 1000 timing records
		if (this.metrics.processingTimes.length > 1000) {
			this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
		}

		// Alert if processing time is too high
		if (duration > 1000) {
			// 1 second threshold
			this.alert("HIGH_PROCESSING_TIME", { operation, duration });
		}
	}

	recordBufferSize(type, size) {
		this.metrics.bufferSizes.push({ type, size, timestamp: new Date() });

		// Keep only last 1000 buffer size records
		if (this.metrics.bufferSizes.length > 1000) {
			this.metrics.bufferSizes = this.metrics.bufferSizes.slice(-1000);
		}

		// Alert if buffer is getting too large
		if (size > CONFIG.MAX_BUFFER_SIZE * 0.8) {
			this.alert("BUFFER_SIZE_WARNING", {
				type,
				size,
				threshold: CONFIG.MAX_BUFFER_SIZE,
			});
		}
	}

	recordDatabaseOperation(operation, duration, success) {
		this.metrics.databaseOperations.push({
			operation,
			duration,
			success,
			timestamp: new Date(),
		});

		// Keep only last 1000 database operation records
		if (this.metrics.databaseOperations.length > 1000) {
			this.metrics.databaseOperations =
				this.metrics.databaseOperations.slice(-1000);
		}

		// Calculate error rate
		const recentOps = this.metrics.databaseOperations.filter(
			(op) => Date.now() - op.timestamp.getTime() < 60000
		); // Last minute

		const errorRate =
			recentOps.filter((op) => !op.success).length / recentOps.length;

		if (errorRate > 0.1) {
			// 10% error rate threshold
			this.alert("HIGH_ERROR_RATE", { errorRate, recentOps: recentOps.length });
		}
	}

	recordMQTTMessage(success = true) {
		this.metrics.mqttMessages.total++;
		if (success) {
			this.metrics.mqttMessages.processed++;
		} else {
			this.metrics.mqttMessages.failed++;
		}
	}

	updateCircuitBreakerStats() {
		for (const [name, breaker] of Object.entries(circuitBreakers)) {
			this.metrics.circuitBreakers[name] = breaker.getStats();
		}
	}

	alert(type, details) {
		const alert = {
			type,
			details,
			timestamp: new Date(),
			severity: this.getSeverity(type),
		};

		this.alerts.push(alert);

		// Keep only last 1000 alerts
		if (this.alerts.length > 1000) {
			this.alerts = this.alerts.slice(-1000);
		}

		// Log critical alerts
		if (alert.severity === "CRITICAL") {
			utils.logWithContext("error", `Performance Alert: ${type}`, details);
		}
	}

	getSeverity(type) {
		const severityMap = {
			HIGH_PROCESSING_TIME: "WARNING",
			BUFFER_SIZE_WARNING: "WARNING",
			HIGH_ERROR_RATE: "CRITICAL",
			MEMORY_PRESSURE: "CRITICAL",
			CIRCUIT_BREAKER_OPEN: "WARNING",
		};

		return severityMap[type] || "INFO";
	}

	getPerformanceReport() {
		const now = Date.now();
		const oneHourAgo = now - 60 * 60 * 1000;
		const oneDayAgo = now - 24 * 60 * 60 * 1000;

		const recentMetrics = {
			processingTimes: this.metrics.processingTimes.filter(
				(m) => m.timestamp.getTime() > oneHourAgo
			),
			bufferSizes: this.metrics.bufferSizes.filter(
				(m) => m.timestamp.getTime() > oneHourAgo
			),
			databaseOperations: this.metrics.databaseOperations.filter(
				(m) => m.timestamp.getTime() > oneHourAgo
			),
			alerts: this.alerts.filter((a) => a.timestamp.getTime() > oneHourAgo),
		};

		// Update circuit breaker stats
		this.updateCircuitBreakerStats();

		return {
			uptime: now - this.startTime,
			mqttMessages: this.metrics.mqttMessages,
			avgProcessingTime: this.calculateAverage(
				recentMetrics.processingTimes,
				"duration"
			),
			avgBufferSize: this.calculateAverage(recentMetrics.bufferSizes, "size"),
			successRate: this.calculateSuccessRate(recentMetrics.databaseOperations),
			alertCount: recentMetrics.alerts.length,
			criticalAlerts: recentMetrics.alerts.filter(
				(a) => a.severity === "CRITICAL"
			).length,
			circuitBreakers: this.metrics.circuitBreakers,
			memoryStats: batchBuffers.getMemoryStats(),
			recommendations: this.generateRecommendations(recentMetrics),
		};
	}

	calculateAverage(array, field) {
		if (array.length === 0) return 0;
		return array.reduce((sum, item) => sum + item[field], 0) / array.length;
	}

	calculateSuccessRate(operations) {
		if (operations.length === 0) return 1;
		const successful = operations.filter((op) => op.success).length;
		return successful / operations.length;
	}

	generateRecommendations(metrics) {
		const recommendations = [];

		// Processing time recommendations
		const avgProcessingTime = this.calculateAverage(
			metrics.processingTimes,
			"duration"
		);
		if (avgProcessingTime > 500) {
			recommendations.push(
				"High processing time detected. Consider optimizing data processing logic."
			);
		}

		// Buffer size recommendations
		const avgBufferSize = this.calculateAverage(metrics.bufferSizes, "size");
		if (avgBufferSize > CONFIG.MAX_BUFFER_SIZE * 0.7) {
			recommendations.push(
				"Buffer sizes are high. Consider reducing batch intervals or increasing thresholds."
			);
		}

		// Error rate recommendations
		const successRate = this.calculateSuccessRate(metrics.databaseOperations);
		if (successRate < 0.95) {
			recommendations.push(
				"High error rate detected. Check database connectivity and query performance."
			);
		}

		// Circuit breaker recommendations
		for (const [name, stats] of Object.entries(this.metrics.circuitBreakers)) {
			if (stats.state === "OPEN") {
				recommendations.push(
					`Circuit breaker ${name} is open. Check external service health.`
				);
			}
		}

		return recommendations;
	}

	// Export metrics in Prometheus format
	exportPrometheusMetrics() {
		let output = "";

		// MQTT metrics
		output += `# HELP mqtt_messages_total Total MQTT messages received\n`;
		output += `# TYPE mqtt_messages_total counter\n`;
		output += `mqtt_messages_total ${this.metrics.mqttMessages.total}\n`;

		output += `# HELP mqtt_messages_processed Total MQTT messages successfully processed\n`;
		output += `# TYPE mqtt_messages_processed counter\n`;
		output += `mqtt_messages_processed ${this.metrics.mqttMessages.processed}\n`;

		output += `# HELP mqtt_messages_failed Total MQTT messages that failed processing\n`;
		output += `# TYPE mqtt_messages_failed counter\n`;
		output += `mqtt_messages_failed ${this.metrics.mqttMessages.failed}\n`;

		output += `# HELP mqtt_message_processing_duration_seconds MQTT message processing duration\n`;
		output += `# TYPE mqtt_message_processing_duration_seconds histogram\n`;
		const mqttTimings = this.metrics.processingTimes.filter(
			(m) => m.operation === "mqtt_message_processing"
		);
		if (mqttTimings.length > 0) {
			const durations = mqttTimings.map((m) => m.duration / 1000); // Convert to seconds
			output += `mqtt_message_processing_duration_seconds_bucket{le="0.01"} ${
				durations.filter((d) => d <= 0.01).length
			}\n`;
			output += `mqtt_message_processing_duration_seconds_bucket{le="0.05"} ${
				durations.filter((d) => d <= 0.05).length
			}\n`;
			output += `mqtt_message_processing_duration_seconds_bucket{le="0.1"} ${
				durations.filter((d) => d <= 0.1).length
			}\n`;
			output += `mqtt_message_processing_duration_seconds_bucket{le="0.5"} ${
				durations.filter((d) => d <= 0.5).length
			}\n`;
			output += `mqtt_message_processing_duration_seconds_bucket{le="1.0"} ${
				durations.filter((d) => d <= 1.0).length
			}\n`;
			output += `mqtt_message_processing_duration_seconds_bucket{le="+Inf"} ${durations.length}\n`;
			output += `mqtt_message_processing_duration_seconds_sum ${durations.reduce(
				(sum, d) => sum + d,
				0
			)}\n`;
			output += `mqtt_message_processing_duration_seconds_count ${durations.length}\n`;
		}

		// Buffer metrics
		const memoryStats = batchBuffers.getMemoryStats();
		output += `# HELP batch_buffer_size Current size of batch buffers\n`;
		output += `# TYPE batch_buffer_size gauge\n`;
		output += `batch_buffer_size ${memoryStats.totalItems}\n`;

		output += `# HELP batch_buffer_memory_pressure Memory pressure indicator\n`;
		output += `# TYPE batch_buffer_memory_pressure gauge\n`;
		output += `batch_buffer_memory_pressure ${
			memoryStats.memoryPressure ? 1 : 0
		}\n`;

		// Database operation metrics
		const recentDbOps = this.metrics.databaseOperations.filter(
			(op) => Date.now() - op.timestamp.getTime() < 60000 // Last minute
		);
		output += `# HELP database_operations_total Total database operations in last minute\n`;
		output += `# TYPE database_operations_total counter\n`;
		output += `database_operations_total ${recentDbOps.length}\n`;

		output += `# HELP database_operations_success_rate Database operation success rate\n`;
		output += `# TYPE database_operations_success_rate gauge\n`;
		output += `database_operations_success_rate ${this.calculateSuccessRate(
			recentDbOps
		)}\n`;

		output += `# HELP database_operation_duration_seconds Database operation duration\n`;
		output += `# TYPE database_operation_duration_seconds histogram\n`;
		if (recentDbOps.length > 0) {
			const durations = recentDbOps.map((op) => op.duration / 1000);
			output += `database_operation_duration_seconds_bucket{le="0.01"} ${
				durations.filter((d) => d <= 0.01).length
			}\n`;
			output += `database_operation_duration_seconds_bucket{le="0.05"} ${
				durations.filter((d) => d <= 0.05).length
			}\n`;
			output += `database_operation_duration_seconds_bucket{le="0.1"} ${
				durations.filter((d) => d <= 0.1).length
			}\n`;
			output += `database_operation_duration_seconds_bucket{le="0.5"} ${
				durations.filter((d) => d <= 0.5).length
			}\n`;
			output += `database_operation_duration_seconds_bucket{le="1.0"} ${
				durations.filter((d) => d <= 1.0).length
			}\n`;
			output += `database_operation_duration_seconds_bucket{le="+Inf"} ${durations.length}\n`;
			output += `database_operation_duration_seconds_sum ${durations.reduce(
				(sum, d) => sum + d,
				0
			)}\n`;
			output += `database_operation_duration_seconds_count ${durations.length}\n`;
		}

		// Circuit breaker metrics
		for (const [name, stats] of Object.entries(this.metrics.circuitBreakers)) {
			output += `# HELP circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)\n`;
			output += `# TYPE circuit_breaker_state gauge\n`;
			const stateValue =
				stats.state === "CLOSED" ? 0 : stats.state === "HALF_OPEN" ? 1 : 2;
			output += `circuit_breaker_state{name="${name}"} ${stateValue}\n`;

			output += `# HELP circuit_breaker_failure_rate Circuit breaker failure rate percentage\n`;
			output += `# TYPE circuit_breaker_failure_rate gauge\n`;
			output += `circuit_breaker_failure_rate{name="${name}"} ${stats.failureRate}\n`;

			output += `# HELP circuit_breaker_total_requests Total requests through circuit breaker\n`;
			output += `# TYPE circuit_breaker_total_requests counter\n`;
			output += `circuit_breaker_total_requests{name="${name}"} ${
				stats.totalRequests || 0
			}\n`;

			output += `# HELP circuit_breaker_failed_requests Total failed requests through circuit breaker\n`;
			output += `# TYPE circuit_breaker_failed_requests counter\n`;
			output += `circuit_breaker_failed_requests{name="${name}"} ${
				stats.failedRequests || 0
			}\n`;
		}

		// Performance alerts
		output += `# HELP performance_alerts_total Total performance alerts generated\n`;
		output += `# TYPE performance_alerts_total counter\n`;
		output += `performance_alerts_total ${this.alerts.length}\n`;

		output += `# HELP performance_alerts_critical_total Total critical performance alerts\n`;
		output += `# TYPE performance_alerts_critical_total counter\n`;
		output += `performance_alerts_critical_total ${
			this.alerts.filter((a) => a.severity === "CRITICAL").length
		}\n`;

		// System health metrics
		output += `# HELP system_health_status System health status (0=healthy, 1=degraded, 2=unhealthy)\n`;
		output += `# TYPE system_health_status gauge\n`;
		const criticalAlerts = this.alerts.filter(
			(a) => a.severity === "CRITICAL"
		).length;
		const healthStatus = criticalAlerts === 0 ? 0 : criticalAlerts > 2 ? 2 : 1;
		output += `system_health_status ${healthStatus}\n`;

		return output;
	}
}

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor();

module.exports = {
	handleMQTTMessage,
	handleDeviceHeartbeat,
	startStatusMonitoring,
	stopStatusMonitoring,
	handleNFCEvent,
	// NEW: Export optimization functions
	writeBatchToDatabase,
	compressOldData,
	forceBatchWrite,
	getDatabaseStats,
	resetBatchBuffers,
	// NEW: Export monitoring and management functions
	getMemoryStats: () => batchBuffers.getMemoryStats(),
	getPerformanceReport: () => performanceMonitor.getPerformanceReport(),
	exportPrometheusMetrics: () => performanceMonitor.exportPrometheusMetrics(),
	getCircuitBreakerStats: () => {
		const stats = {};
		for (const [name, breaker] of Object.entries(circuitBreakers)) {
			stats[name] = breaker.getStats();
		}
		return stats;
	},
	resetCircuitBreakers: () => {
		for (const breaker of Object.values(circuitBreakers)) {
			breaker.reset();
		}
	},
	// Export utilities for testing
	utils: process.env.NODE_ENV === "test" ? utils : undefined,
	CONFIG: process.env.NODE_ENV === "test" ? CONFIG : undefined,
};
