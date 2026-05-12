const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const auth = require("../middleware/auth");
const Alert = require("../models/Alert");
const BillingRecord = require("../models/BillingRecord");
const StockThreshold = require("../models/StockThreshold");
const Warehouse = require("../models/Warehouse");
const Device = require("../models/Device");
const IngredientStatus = require("../models/IngredientStatus");

const LOW_STOCK_TYPES = ["LOW_STOCK", "EMPTY", "DEPLETION"];

function formatMoney(amount, currency) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency || "USD",
	}).format(Number(amount) || 0);
}

async function resolveDeviceReference(deviceId) {
	if (!deviceId) return null;
	const normalizedRackId = String(deviceId).trim().toLowerCase();
	const query = { rackId: normalizedRackId };
	if (mongoose.Types.ObjectId.isValid(deviceId)) {
		query.$or = [{ _id: deviceId }, { rackId: normalizedRackId }];
	}
	return Device.findOne(query);
}

async function getOrCreateWarehouse(userId) {
	let warehouse = await Warehouse.findOne({ owner: userId });
	if (!warehouse) {
		warehouse = await Warehouse.create({ owner: userId, name: "Main Warehouse" });
	}
	return warehouse;
}

router.get("/overview", auth, async (req, res) => {
	try {
		const warehouse = await getOrCreateWarehouse(req.user._id);
		const [activeAlerts, activeBills, thresholds, devices, stockStatus] = await Promise.all([
			Alert.countDocuments({ userId: req.user._id, acknowledged: false, type: { $in: LOW_STOCK_TYPES } }),
			BillingRecord.countDocuments({ userId: req.user._id, status: "PENDING" }),
			StockThreshold.countDocuments({ userId: req.user._id, isActive: true }),
			Device.countDocuments({ owner: req.user._id }),
			IngredientStatus.find({ user: req.user._id }).populate({ path: "device", select: "name rackId" }).sort({ lastUpdated: -1 }).limit(20),
		]);

		res.json({
			warehouse,
			counts: {
				activeAlerts,
				activeBills,
				thresholds,
				devices,
			},
			stockStatus: stockStatus.map((item) => ({
				_id: item._id,
				ingredient: item.ingredient,
				slotId: item.slotId,
				weight: item.weight,
				status: item.status,
				lastUpdated: item.lastUpdated,
				device: item.device ? { _id: item.device._id, name: item.device.name, rackId: item.device.rackId } : null,
			})),
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/alerts", auth, async (req, res) => {
	try {
		const alerts = await Alert.find({ userId: req.user._id, type: { $in: LOW_STOCK_TYPES } })
			.populate({ path: "device", select: "name rackId" })
			.sort({ createdAt: -1 })
			.limit(100);

		res.json(alerts.map((alert) => ({
			_id: alert._id,
			type: alert.type,
			ingredient: alert.ingredient,
			slotId: alert.slotId,
			acknowledged: alert.acknowledged,
			createdAt: alert.createdAt,
			device: alert.device ? { _id: alert.device._id, name: alert.device.name, rackId: alert.device.rackId } : null,
		})));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/billing", auth, async (req, res) => {
	try {
		const records = await BillingRecord.find({ userId: req.user._id }).populate({ path: "device", select: "name rackId" }).sort({ issuedAt: -1 }).limit(100);
		res.json(records.map((record) => ({
			_id: record._id,
			ingredient: record.ingredient,
			slotId: record.slotId,
			quantity: record.quantity,
			invoiceNumber: record.invoiceNumber,
			unitPrice: record.unitPrice,
			totalAmount: record.totalAmount,
			currency: record.currency,
			status: record.status,
			issuedAt: record.issuedAt,
			device: record.device ? { _id: record.device._id, name: record.device.name, rackId: record.device.rackId } : null,
		})));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.patch("/billing/:billingId/paid", auth, async (req, res) => {
	try {
		const record = await BillingRecord.findOneAndUpdate(
			{ _id: req.params.billingId, userId: req.user._id, status: "PENDING" },
			{ status: "PAID", paidAt: new Date() },
			{ new: true }
		);

		if (!record) {
			return res.status(404).json({ error: "Billing record not found" });
		}

		res.json({
			_id: record._id,
			invoiceNumber: record.invoiceNumber,
			status: record.status,
			paidAt: record.paidAt,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/billing/:billingId/pdf", auth, async (req, res) => {
	try {
		const record = await BillingRecord.findOne({ _id: req.params.billingId, userId: req.user._id })
			.populate({ path: "device", select: "name rackId location" })
			.populate({ path: "warehouse", select: "name location contactEmail" });

		if (!record) {
			return res.status(404).json({ error: "Billing record not found" });
		}

		const invoiceNumber = record.invoiceNumber || `INV-${String(record._id).slice(-8).toUpperCase()}`;
		const document = new PDFDocument({ size: "A4", margin: 48 });
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
		document.pipe(res);

		document
			.fillColor("#111827")
			.fontSize(22)
			.text("IntelliRack Warehouse Bill", { align: "left" });

		document
			.moveDown(0.25)
			.fontSize(11)
			.fillColor("#6b7280")
			.text("Warehouse billing statement generated from low-stock events");

		document.moveDown(1);
		document.roundedRect(48, 120, 499, 88, 12).fillAndStroke("#f8fafc", "#e5e7eb");
		document.fillColor("#111827").fontSize(10);
		document.text(`Invoice: ${invoiceNumber}`, 64, 138);
		document.text(`Issued: ${(record.issuedAt || record.generatedAt || new Date()).toLocaleString()}`, 64, 154);
		document.text(`Status: ${record.status}`, 320, 138);
		document.text(`Currency: ${record.currency || "USD"}`, 320, 154);

		document.moveDown(2.5);
		document.fontSize(14).fillColor("#111827").text("Bill Details");
		document.moveDown(0.5);
		document.fontSize(11).fillColor("#374151");
		document.text(`Ingredient: ${record.ingredient}`);
		document.text(`Device: ${record.device?.name || record.device?.rackId || "Unknown device"}`);
		document.text(`Slot: ${record.slotId}`);
		document.text(`Quantity: ${Number(record.quantity).toFixed(2)} kg`);
		document.text(`Unit price: ${formatMoney(record.unitPrice, record.currency)} / kg`);
		document.text(`Total amount: ${formatMoney(record.totalAmount, record.currency)}`);
		document.text(`Low-stock threshold: ${record.threshold}`);
		document.text(`Triggered weight: ${record.triggeredWeight}g`);

		if (record.warehouse) {
			document.moveDown(0.5);
			document.text(`Warehouse: ${record.warehouse.name || "Warehouse"}`);
			if (record.warehouse.location) document.text(`Location: ${record.warehouse.location}`);
			if (record.warehouse.contactEmail) document.text(`Contact: ${record.warehouse.contactEmail}`);
		}

		if (record.notes) {
			document.moveDown(0.5);
			document.text(`Notes: ${record.notes}`);
		}

		document.moveDown(1.5);
		document.fontSize(9).fillColor("#6b7280").text("This PDF was generated automatically from warehouse low-stock billing data.");

		document.end();
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/thresholds", auth, async (req, res) => {
	try {
		const thresholds = await StockThreshold.find({ userId: req.user._id }).populate({ path: "device", select: "name rackId" }).sort({ updatedAt: -1 });
		res.json(thresholds);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.put("/thresholds", auth, async (req, res) => {
	try {
		const warehouse = await getOrCreateWarehouse(req.user._id);
		const { deviceId, ingredient, slotId = 1, lowThreshold = 100, reorderQuantity = 1, unitPrice = 0, currency = "USD", autoBillEnabled = true } = req.body;
		if (!ingredient) {
			return res.status(400).json({ error: "ingredient is required" });
		}

		const device = await resolveDeviceReference(deviceId);
		if (deviceId && !device) {
			return res.status(404).json({ error: "Device not found" });
		}

		const threshold = await StockThreshold.findOneAndUpdate(
			{ userId: req.user._id, device: device?._id || null, ingredient, slotId },
			{ userId: req.user._id, warehouse: warehouse._id, device: device?._id || null, ingredient, slotId, lowThreshold, reorderQuantity, unitPrice, currency, autoBillEnabled, isActive: true },
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);

		res.json(threshold);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;