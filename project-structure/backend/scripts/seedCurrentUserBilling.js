require("dotenv").config();
const mongoose = require("mongoose");
const BillingRecord = require("../models/BillingRecord");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const User = require("../models/User");

async function main() {
	const mongoUri = process.env.MONGO_URI;
	if (!mongoUri) {
		throw new Error("MONGO_URI is required");
	}

	const targetDeviceLabel = process.env.WAREHOUSE_SEED_DEVICE || "newpcb_002";
	const invoicePrefix = process.env.WAREHOUSE_SEED_INVOICE_PREFIX || "INV-SAMPLE-CURRENT";
	const sampleInvoices = [
		{
			invoiceNumber: `${invoicePrefix}-001`,
			ingredient: process.env.WAREHOUSE_SEED_INGREDIENT_1 || "Snacks",
			quantity: 0.5,
			unitPrice: 19.98,
			status: "PENDING",
			notes: "Sample billing invoice 1",
		},
		{
			invoiceNumber: `${invoicePrefix}-002`,
			ingredient: process.env.WAREHOUSE_SEED_INGREDIENT_2 || "Flour",
			quantity: 1.25,
			unitPrice: 20,
			status: "PAID",
			notes: "Sample billing invoice 2",
		},
		{
			invoiceNumber: `${invoicePrefix}-003`,
			ingredient: process.env.WAREHOUSE_SEED_INGREDIENT_3 || "Milk",
			quantity: 2.75,
			unitPrice: 8,
			status: "CANCELLED",
			notes: "Sample billing invoice 3",
		},
	];

	await mongoose.connect(mongoUri);

	const device = await Device.findOne({
		$or: [{ rackId: targetDeviceLabel }, { name: targetDeviceLabel }],
	}).populate("owner");
	if (!device) {
		throw new Error(`Device not found for label ${targetDeviceLabel}`);
	}

	const userId = device.owner?._id || device.owner;
	if (!userId) {
		throw new Error(`Device ${targetDeviceLabel} does not have an owner`);
	}

	const createdRecords = [];
	for (const [index, invoice] of sampleInvoices.entries()) {
		const existing = await BillingRecord.findOne({ userId, invoiceNumber: invoice.invoiceNumber });
		if (existing) {
			createdRecords.push(existing);
			continue;
		}

		const alert = await Alert.findOne({
			userId,
			device: device._id,
			ingredient: invoice.ingredient,
			type: { $in: ["LOW_STOCK", "EMPTY", "DEPLETION"] },
		}).sort({ createdAt: -1 });

		const billingRecord = await BillingRecord.create({
			userId,
			warehouse: undefined,
			device: device._id,
			alert: alert?._id,
			invoiceNumber: invoice.invoiceNumber,
			ingredient: alert?.ingredient || invoice.ingredient,
			slotId: Number(alert?.slotId) || index + 1,
			quantity: invoice.quantity,
			unitPrice: invoice.unitPrice,
			totalAmount: Number((invoice.quantity * invoice.unitPrice).toFixed(2)),
			currency: "USD",
			status: invoice.status,
			threshold: 100,
			triggeredWeight: Number(device.lastWeight) || 0,
			notes: invoice.notes,
			paidAt: invoice.status === "PAID" ? new Date() : undefined,
			cancelledAt: invoice.status === "CANCELLED" ? new Date() : undefined,
		});

		createdRecords.push(billingRecord);
	}

	console.log("Sample billing inserted:");
	console.log(
		createdRecords.map((record) => ({
			billingId: record._id.toString(),
			invoiceNumber: record.invoiceNumber,
			userId: userId.toString(),
			deviceName: device.name,
			rackId: device.rackId,
			ingredient: record.ingredient,
			quantityKg: record.quantity,
			status: record.status,
		}))
	);

	await mongoose.disconnect();
}

main().catch(async (error) => {
	console.error("Failed to seed current-user billing:", error);
	try {
		await mongoose.disconnect();
	} catch {
		// ignore disconnect errors
	}
	process.exit(1);
});