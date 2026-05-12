require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Device = require("../models/Device");
const Warehouse = require("../models/Warehouse");
const Alert = require("../models/Alert");
const BillingRecord = require("../models/BillingRecord");

async function ensureSampleUser() {
	const sampleEmail = process.env.SAMPLE_WAREHOUSE_USER_EMAIL || "warehouse.demo@intellirack.local";
	let user = await User.findOne({ email: sampleEmail });
	if (!user) {
		user = await User.create({
			name: "Warehouse Demo",
			email: sampleEmail,
			passwordHash: await bcrypt.hash("Demo12345!", 10),
		});
	}
	return user;
}

async function ensureSampleDevice(user) {
	let device = await Device.findOne({ owner: user._id, rackId: "rack-demo-1" });
	if (!device) {
		device = await Device.create({
			name: "Demo Rack 1",
			rackId: "rack-demo-1",
			location: "Warehouse Aisle 3",
			owner: user._id,
			isOnline: true,
			lastSeen: new Date(),
			lastWeight: 72,
			lastStatus: "LOW",
		});
	}
	return device;
}

async function ensureWarehouse(user) {
	let warehouse = await Warehouse.findOne({ owner: user._id });
	if (!warehouse) {
		warehouse = await Warehouse.create({
			owner: user._id,
			name: "Main Warehouse",
			location: "Warehouse A",
			contactEmail: user.email,
		});
	}
	return warehouse;
}

async function main() {
	const mongoUri = process.env.MONGO_URI;
	if (!mongoUri) {
		throw new Error("MONGO_URI is required");
	}

	await mongoose.connect(mongoUri);

	const user = await ensureSampleUser();
	const device = await ensureSampleDevice(user);
	const warehouse = await ensureWarehouse(user);

	const ingredient = "Sample Sugar";
	const slotId = 2;

	// create or find an alert
	const alert =
		(await Alert.findOne({
			userId: user._id,
			device: device._id,
			slotId: String(slotId),
			ingredient,
			type: "LOW_STOCK",
			acknowledged: false,
		})) ||
		(await Alert.create({
			userId: user._id,
			device: device._id,
			slotId: String(slotId),
			ingredient,
			type: "LOW_STOCK",
			acknowledged: false,
		}));

	const invoiceNumber = "INV-SAMPLE-0002";
	const existing = await BillingRecord.findOne({ userId: user._id, invoiceNumber });
	if (existing) {
		console.log("Sample billing already exists:", existing._id.toString());
		await mongoose.disconnect();
		return;
	}

	const billingRecord = await BillingRecord.create({
		userId: user._id,
		warehouse: warehouse._id,
		device: device._id,
		alert: alert._id,
		invoiceNumber,
		ingredient,
		slotId,
		quantity: 1.5,
		unitPrice: 10.0,
		totalAmount: 15.0,
		currency: "USD",
		status: "PAID",
		threshold: 100,
		triggeredWeight: 65,
		notes: "Sample paid billing record",
		paidAt: new Date(),
	});

	console.log("Sample billing inserted:", billingRecord._id.toString(), invoiceNumber, `${billingRecord.quantity} kg`);
	await mongoose.disconnect();
}

main().catch(async (error) => {
	console.error("Failed to add sample billing:", error);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});