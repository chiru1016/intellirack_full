const mongoose = require("mongoose");

const stockThresholdSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" },
		device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
		ingredient: { type: String, required: true },
		slotId: { type: Number, default: 1 },
		lowThreshold: { type: Number, default: 100 },
		reorderQuantity: { type: Number, default: 1 },
		unitPrice: { type: Number, default: 0 },
		currency: { type: String, default: "USD" },
		autoBillEnabled: { type: Boolean, default: true },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

stockThresholdSchema.index(
	{ userId: 1, device: 1, ingredient: 1, slotId: 1 },
	{ unique: true }
);

module.exports = mongoose.model("StockThreshold", stockThresholdSchema);