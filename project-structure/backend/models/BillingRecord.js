const mongoose = require("mongoose");

const billingRecordSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" },
		device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
		alert: { type: mongoose.Schema.Types.ObjectId, ref: "Alert" },
		invoiceNumber: { type: String, required: true, unique: true },
		ingredient: { type: String, required: true },
		slotId: { type: Number, default: 1 },
		quantity: { type: Number, default: 1 },
		unitPrice: { type: Number, default: 0 },
		totalAmount: { type: Number, default: 0 },
		currency: { type: String, default: "USD" },
		status: {
			type: String,
			enum: ["PENDING", "PAID", "CANCELLED"],
			default: "PENDING",
		},
		threshold: { type: Number, default: 0 },
		triggeredWeight: { type: Number, default: 0 },
		generatedAt: { type: Date, default: Date.now },
		issuedAt: { type: Date, default: Date.now },
		paidAt: { type: Date },
		cancelledAt: { type: Date },
		notes: { type: String, default: "" },
	},
	{ timestamps: true }
);

billingRecordSchema.index({ userId: 1, device: 1, ingredient: 1, slotId: 1, status: 1 });

module.exports = mongoose.model("BillingRecord", billingRecordSchema);