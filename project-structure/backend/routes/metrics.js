const express = require("express");
const router = express.Router();
const mqttHandler = require("../controllers/mqttHandler");
const os = require("os");

// Middleware to check if metrics endpoint is enabled
const metricsEnabled = process.env.METRICS_ENABLED !== "false";

// Prometheus metrics endpoint
router.get("/prometheus", async (req, res) => {
	if (!metricsEnabled) {
		return res.status(404).json({ error: "Metrics endpoint disabled" });
	}

	try {
		// Get MQTT handler metrics
		const mqttMetrics = mqttHandler.exportPrometheusMetrics();

		// Get system metrics
		const systemMetrics = generateSystemMetrics();

		// Get database metrics
		const dbMetrics = await generateDatabaseMetrics();

		// Combine all metrics
		const allMetrics = [
			"# IntelliRack System Metrics",
			"# Generated at: " + new Date().toISOString(),
			"",
			mqttMetrics,
			"",
			systemMetrics,
			"",
			dbMetrics,
		].join("\n");

		res.set("Content-Type", "text/plain");
		res.send(allMetrics);
	} catch (error) {
		console.error("Error generating metrics:", error);
		res.status(500).json({ error: "Failed to generate metrics" });
	}
});

// JSON metrics endpoint for internal use
router.get("/json", async (req, res) => {
	if (!metricsEnabled) {
		return res.status(404).json({ error: "Metrics endpoint disabled" });
	}

	try {
		const metrics = {
			timestamp: new Date().toISOString(),
			system: getSystemInfo(),
			performance: mqttHandler.getPerformanceReport(),
			memory: mqttHandler.getMemoryStats(),
			uptime: process.uptime(),
			version: process.env.npm_package_version || "1.0.0",
		};

		res.json(metrics);
	} catch (error) {
		console.error("Error generating JSON metrics:", error);
		res.status(500).json({ error: "Failed to generate metrics" });
	}
});

// Health check endpoint
router.get("/health", (req, res) => {
	const health = {
		status: "healthy",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		memory: {
			used: process.memoryUsage().heapUsed,
			total: process.memoryUsage().heapTotal,
			external: process.memoryUsage().external,
			rss: process.memoryUsage().rss,
		},
		cpu: {
			load: os.loadavg(),
			cores: os.cpus().length,
		},
	};

	// Check if system is healthy
	const memoryUsage = health.memory.used / health.memory.total;
	if (memoryUsage > 0.9) {
		health.status = "degraded";
		health.warnings = ["High memory usage detected"];
	}

	if (health.memory.used > 500 * 1024 * 1024) {
		// 500MB
		health.status = "degraded";
		if (!health.warnings) health.warnings = [];
		health.warnings.push("Memory usage above 500MB");
	}

	res.json(health);
});

// Generate system-level metrics
function generateSystemMetrics() {
	const memUsage = process.memoryUsage();
	const cpuLoad = os.loadavg();
	const uptime = process.uptime();

	let metrics = "";

	// System uptime
	metrics += `# HELP process_uptime_seconds Total uptime of the process\n`;
	metrics += `# TYPE process_uptime_seconds counter\n`;
	metrics += `process_uptime_seconds ${uptime}\n`;

	// Memory metrics
	metrics += `# HELP process_memory_heap_used_bytes Heap memory used in bytes\n`;
	metrics += `# TYPE process_memory_heap_used_bytes gauge\n`;
	metrics += `process_memory_heap_used_bytes ${memUsage.heapUsed}\n`;

	metrics += `# HELP process_memory_heap_total_bytes Total heap memory in bytes\n`;
	metrics += `# TYPE process_memory_heap_total_bytes gauge\n`;
	metrics += `process_memory_heap_total_bytes ${memUsage.heapTotal}\n`;

	metrics += `# HELP process_memory_rss_bytes Resident set size in bytes\n`;
	metrics += `# TYPE process_memory_rss_bytes gauge\n`;
	metrics += `process_memory_rss_bytes ${memUsage.rss}\n`;

	// CPU metrics
	metrics += `# HELP system_cpu_load_1m 1 minute load average\n`;
	metrics += `# TYPE system_cpu_load_1m gauge\n`;
	metrics += `system_cpu_load_1m ${cpuLoad[0]}\n`;

	metrics += `# HELP system_cpu_load_5m 5 minute load average\n`;
	metrics += `# TYPE system_cpu_load_5m gauge\n`;
	metrics += `system_cpu_load_5m ${cpuLoad[1]}\n`;

	metrics += `# HELP system_cpu_load_15m 15 minute load average\n`;
	metrics += `# TYPE system_cpu_load_15m gauge\n`;
	metrics += `system_cpu_load_15m ${cpuLoad[2]}\n`;

	// Node.js specific metrics
	metrics += `# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds\n`;
	metrics += `# TYPE nodejs_eventloop_lag_seconds gauge\n`;
	metrics += `nodejs_eventloop_lag_seconds 0\n`; // Placeholder for now

	// Network metrics
	metrics += `# HELP nodejs_active_handles_total Number of active handles\n`;
	metrics += `# TYPE nodejs_active_handles_total gauge\n`;
	metrics += `nodejs_active_handles_total ${
		process._getActiveHandles ? process._getActiveHandles().length : 0
	}\n`;

	return metrics;
}

// Generate database metrics
async function generateDatabaseMetrics() {
	let metrics = "";

	try {
		// Database connection metrics (if you have connection pooling)
		metrics += `# HELP database_connections_active Active database connections\n`;
		metrics += `# TYPE database_connections_active gauge\n`;
		metrics += `database_connections_active 1\n`; // Placeholder

		metrics += `# HELP database_connections_idle Idle database connections\n`;
		metrics += `# TYPE database_connections_idle gauge\n`;
		metrics += `database_connections_idle 0\n`; // Placeholder

		// Database operation metrics
		metrics += `# HELP database_operations_total Total database operations\n`;
		metrics += `# TYPE database_operations_total counter\n`;
		metrics += `database_operations_total 0\n`; // Will be updated by mqttHandler

		metrics += `# HELP database_operations_duration_seconds Database operation duration in seconds\n`;
		metrics += `# TYPE database_operations_duration_seconds histogram\n`;
		metrics += `database_operations_duration_seconds_bucket{le="0.1"} 0\n`;
		metrics += `database_operations_duration_seconds_bucket{le="0.5"} 0\n`;
		metrics += `database_operations_duration_seconds_bucket{le="1.0"} 0\n`;
		metrics += `database_operations_duration_seconds_bucket{le="5.0"} 0\n`;
		metrics += `database_operations_duration_seconds_bucket{le="+Inf"} 0\n`;
		metrics += `database_operations_duration_seconds_sum 0\n`;
		metrics += `database_operations_duration_seconds_count 0\n`;
	} catch (error) {
		console.error("Error generating database metrics:", error);
		metrics += `# HELP database_metrics_error Error generating database metrics\n`;
		metrics += `# TYPE database_metrics_error gauge\n`;
		metrics += `database_metrics_error 1\n`;
	}

	return metrics;
}

// Get system information
function getSystemInfo() {
	return {
		platform: process.platform,
		arch: process.arch,
		nodeVersion: process.version,
		pid: process.pid,
		uptime: process.uptime(),
		memory: process.memoryUsage(),
		cpu: {
			load: os.loadavg(),
			cores: os.cpus().length,
			model: os.cpus()[0]?.model || "Unknown",
		},
		network: {
			interfaces: os.networkInterfaces(),
		},
	};
}

module.exports = router;
