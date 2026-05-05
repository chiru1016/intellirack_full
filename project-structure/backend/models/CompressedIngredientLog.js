const mongoose = require("mongoose");

const compressedIngredientLogSchema = new mongoose.Schema(
	{
		device: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Device",
			required: true,
			index: true,
		},
		slotId: {
			type: Number,
			required: true,
		},
		ingredient: {
			type: String,
			required: true,
			index: true,
		},
		date: {
			type: String, // YYYY-MM-DD format
			required: true,
			index: true,
		},
		// Aggregated weight data
		minWeight: {
			type: Number,
			required: true,
		},
		maxWeight: {
			type: Number,
			required: true,
		},
		avgWeight: {
			type: Number,
			required: true,
		},
		// Count of original records
		count: {
			type: Number,
			required: true,
		},
		// Timestamp range
		firstTimestamp: {
			type: Date,
			required: true,
		},
		lastTimestamp: {
			type: Date,
			required: true,
		},
		// All statuses that occurred during this period
		statuses: [
			{
				type: String,
			},
		],
		// Compression metadata
		compressed: {
			type: Boolean,
			default: true,
		},
		compressedAt: {
			type: Date,
			default: Date.now,
		},
		// Original data size (for compression ratio tracking)
		originalSize: {
			type: Number,
			description: "Size of original data in bytes (approximate)",
		},
		compressedSize: {
			type: Number,
			description: "Size of compressed data in bytes",
		},
		compressionRatio: {
			type: Number,
			description: "Compression ratio (original/compressed)",
		},
	},
	{
		timestamps: true,
	}
);

// Compound index for efficient querying
compressedIngredientLogSchema.index(
	{ device: 1, slotId: 1, ingredient: 1, date: 1 },
	{ unique: true }
);

// Index for date-based queries
compressedIngredientLogSchema.index({ date: 1 });

// Index for device-based queries
compressedIngredientLogSchema.index({ device: 1 });

// Index for ingredient-based queries
compressedIngredientLogSchema.index({ ingredient: 1 });

// Index for compression metadata
compressedIngredientLogSchema.index({ compressedAt: 1 });

// Virtual for compression ratio calculation
compressedIngredientLogSchema
	.virtual("calculatedCompressionRatio")
	.get(function () {
		if (this.originalSize && this.compressedSize) {
			return this.originalSize / this.compressedSize;
		}
		return null;
	});

// Method to get compression statistics
compressedIngredientLogSchema.statics.getCompressionStats = async function () {
	const stats = await this.aggregate([
		{
			$group: {
				_id: null,
				totalRecords: { $sum: 1 },
				totalOriginalSize: { $sum: "$originalSize" },
				totalCompressedSize: { $sum: "$compressedSize" },
				avgCompressionRatio: { $avg: "$compressionRatio" },
				minCompressionRatio: { $min: "$compressionRatio" },
				maxCompressionRatio: { $max: "$compressionRatio" },
			},
		},
	]);

	return stats[0] || null;
};

// Method to get compression stats by date range
compressedIngredientLogSchema.statics.getCompressionStatsByDate =
	async function (startDate, endDate) {
		const matchStage = {};
		if (startDate || endDate) {
			matchStage.date = {};
			if (startDate) matchStage.date.$gte = startDate;
			if (endDate) matchStage.date.$lte = endDate;
		}

		const pipeline = [];
		if (Object.keys(matchStage).length > 0) {
			pipeline.push({ $match: matchStage });
		}

		pipeline.push({
			$group: {
				_id: "$date",
				recordCount: { $sum: 1 },
				totalOriginalSize: { $sum: "$originalSize" },
				totalCompressedSize: { $sum: "$compressedSize" },
				avgCompressionRatio: { $avg: "$compressionRatio" },
			},
		});

		pipeline.push({
			$sort: { _id: 1 },
		});

		return await this.aggregate(pipeline);
	};

// Method to get storage savings
compressedIngredientLogSchema.statics.getStorageSavings = async function () {
	const stats = await this.getCompressionStats();
	if (!stats) return null;

	const savings = {
		originalSize: stats.totalOriginalSize || 0,
		compressedSize: stats.totalCompressedSize || 0,
		savedBytes: 0,
		savedPercentage: 0,
		savedMB: 0,
		savedGB: 0,
	};

	savings.savedBytes = savings.originalSize - savings.compressedSize;
	savings.savedPercentage =
		savings.originalSize > 0
			? (savings.savedBytes / savings.originalSize) * 100
			: 0;
	savings.savedMB = savings.savedBytes / (1024 * 1024);
	savings.savedGB = savings.savedBytes / (1024 * 1024 * 1024);

	return savings;
};

// Method to find records by ingredient and date range
compressedIngredientLogSchema.statics.findByIngredientAndDateRange =
	async function (ingredient, startDate, endDate, deviceId = null) {
		const query = {
			ingredient: ingredient,
			date: {
				$gte: startDate,
				$lte: endDate,
			},
		};

		if (deviceId) {
			query.device = deviceId;
		}

		return await this.find(query).sort({ date: 1 });
	};

// Method to get daily summary for an ingredient
compressedIngredientLogSchema.statics.getDailySummary = async function (
	ingredient,
	deviceId = null,
	days = 30
) {
	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const query = {
		ingredient: ingredient,
		date: {
			$gte: startDate.toISOString().split("T")[0],
			$lte: endDate.toISOString().split("T")[0],
		},
	};

	if (deviceId) {
		query.device = deviceId;
	}

	return await this.find(query)
		.sort({ date: 1 })
		.select("date minWeight maxWeight avgWeight count statuses");
};

// Pre-save middleware to calculate compression ratio
compressedIngredientLogSchema.pre("save", function (next) {
	if (this.originalSize && this.compressedSize) {
		this.compressionRatio = this.originalSize / this.compressedSize;
	}
	next();
});

// Instance method to get weight trend
compressedIngredientLogSchema.methods.getWeightTrend = function () {
	if (this.minWeight === this.maxWeight) {
		return "STABLE";
	}

	const weightRange = this.maxWeight - this.minWeight;
	const avgWeight = this.avgWeight;

	if (weightRange < avgWeight * 0.1) {
		return "STABLE";
	} else if (this.maxWeight > avgWeight * 1.2) {
		return "INCREASING";
	} else if (this.minWeight < avgWeight * 0.8) {
		return "DECREASING";
	} else {
		return "VARIABLE";
	}
};

// Instance method to get status summary
compressedIngredientLogSchema.methods.getStatusSummary = function () {
	const statusCounts = {};
	this.statuses.forEach((status) => {
		statusCounts[status] = (statusCounts[status] || 0) + 1;
	});

	return Object.entries(statusCounts)
		.sort(([, a], [, b]) => b - a)
		.map(([status, count]) => ({ status, count }));
};

module.exports = mongoose.model(
	"CompressedIngredientLog",
	compressedIngredientLogSchema
);
