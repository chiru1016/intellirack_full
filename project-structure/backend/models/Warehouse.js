const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
	{
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
		name: { type: String, default: "Main Warehouse" },
		location: { type: String, default: "" },
		contactEmail: { type: String, default: "" },
		autoBillingEnabled: { type: Boolean, default: true },
		lowStockNotificationEnabled: { type: Boolean, default: true },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

warehouseSchema.index({ owner: 1 }, { unique: true });

module.exports = mongoose.model("Warehouse", warehouseSchema);