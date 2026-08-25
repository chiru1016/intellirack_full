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
		const document = new PDFDocument({ size: "A4", margin: 0, info: { Title: invoiceNumber, Author: "IntelliRack" } });
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
		document.pipe(res);

		const PAGE_W = 595;
		const PAGE_H = 842;
		const MARGIN = 48;
		const CONTENT_W = PAGE_W - MARGIN * 2;

		// ── Header bar ────────────────────────────────────────────────────────────
		document.rect(0, 0, PAGE_W, 90).fill("#0f172a");
		document.fontSize(22).fillColor("#ffffff").font("Helvetica-Bold").text("IntelliRack", MARGIN, 24, { continued: true });
		document.fontSize(22).fillColor("#38bdf8").font("Helvetica-Bold").text(" Warehouse");
		document.fontSize(9).fillColor("#94a3b8").font("Helvetica").text("BILLING INVOICE", MARGIN, 56, { characterSpacing: 2 });

		// Invoice number top-right
		document.fontSize(9).fillColor("#94a3b8").font("Helvetica").text(invoiceNumber, 0, 30, { align: "right", width: PAGE_W - MARGIN });

		// ── Status badge ──────────────────────────────────────────────────────────
		const status = (record.status || "PENDING").toUpperCase();
		const statusColors = { PAID: "#16a34a", CANCELLED: "#dc2626", PENDING: "#d97706", OVERDUE: "#9333ea" };
		const badgeColor = statusColors[status] || "#475569";
		const badgeX = PAGE_W - MARGIN - 80;
		const badgeY = 56;
		document.roundedRect(badgeX, badgeY, 80, 18, 4).fill(badgeColor);
		document.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold").text(status, badgeX, badgeY + 5, { width: 80, align: "center", characterSpacing: 1 });

		// ── Meta cards row ────────────────────────────────────────────────────────
		const cardY = 108;
		const cardH = 72;
		const cardW = (CONTENT_W - 12) / 2;

		// Left card
		document.roundedRect(MARGIN, cardY, cardW, cardH, 8).fillAndStroke("#f8fafc", "#e2e8f0");
		document.fontSize(7).fillColor("#94a3b8").font("Helvetica-Bold").text("INVOICE NUMBER", MARGIN + 14, cardY + 12, { characterSpacing: 1 });
		document.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text(invoiceNumber, MARGIN + 14, cardY + 24);
		document.fontSize(7).fillColor("#94a3b8").font("Helvetica-Bold").text("ISSUE DATE", MARGIN + 14, cardY + 44, { characterSpacing: 1 });
		document.fontSize(9).fillColor("#374151").font("Helvetica").text(
			(record.issuedAt || record.generatedAt || new Date()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
			MARGIN + 14, cardY + 55
		);

		// Right card
		const card2X = MARGIN + cardW + 12;
		document.roundedRect(card2X, cardY, cardW, cardH, 8).fillAndStroke("#f8fafc", "#e2e8f0");
		document.fontSize(7).fillColor("#94a3b8").font("Helvetica-Bold").text("CURRENCY", card2X + 14, cardY + 12, { characterSpacing: 1 });
		document.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text(record.currency || "USD", card2X + 14, cardY + 24);
		if (record.warehouse) {
			document.fontSize(7).fillColor("#94a3b8").font("Helvetica-Bold").text("WAREHOUSE", card2X + 14, cardY + 44, { characterSpacing: 1 });
			document.fontSize(9).fillColor("#374151").font("Helvetica").text(record.warehouse.name || "—", card2X + 14, cardY + 55);
		}

		// ── Section heading: Line Items ───────────────────────────────────────────
		const tableTop = cardY + cardH + 28;
		document.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold").text("Line Items", MARGIN, tableTop);
		document.moveTo(MARGIN, tableTop + 18).lineTo(MARGIN + CONTENT_W, tableTop + 18).lineWidth(1).strokeColor("#e2e8f0").stroke();

		// Table header row
		const thY = tableTop + 24;
		document.rect(MARGIN, thY, CONTENT_W, 22).fill("#0f172a");
		document.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold");
		const cols = [
			{ label: "DESCRIPTION", x: MARGIN + 10, w: 180 },
			{ label: "DEVICE / SLOT", x: MARGIN + 195, w: 120 },
			{ label: "QTY (kg)", x: MARGIN + 320, w: 70, align: "right" },
			{ label: "UNIT PRICE", x: MARGIN + 395, w: 70, align: "right" },
			{ label: "AMOUNT", x: MARGIN + 468, w: CONTENT_W - 468 - 10, align: "right" },
		];
		cols.forEach(c => document.text(c.label, c.x, thY + 7, { width: c.w, align: c.align || "left", characterSpacing: 0.5 }));

		// Single data row (alternating background)
		const rowY = thY + 22;
		document.rect(MARGIN, rowY, CONTENT_W, 28).fill("#f8fafc");
		document.fontSize(9).fillColor("#111827").font("Helvetica");
		const deviceLabel = record.device?.name || record.device?.rackId || "Unknown device";
		document.text(record.ingredient || "—", cols[0].x, rowY + 9, { width: cols[0].w });
		document.text(`${deviceLabel} / ${record.slotId}`, cols[1].x, rowY + 9, { width: cols[1].w });
		document.text(Number(record.quantity).toFixed(2), cols[2].x, rowY + 9, { width: cols[2].w, align: "right" });
		document.text(`${formatMoney(record.unitPrice, record.currency)}/kg`, cols[3].x, rowY + 9, { width: cols[3].w, align: "right" });
		document.fillColor("#0f172a").font("Helvetica-Bold")
			.text(formatMoney(record.totalAmount, record.currency), cols[4].x, rowY + 9, { width: cols[4].w, align: "right" });

		// Bottom border of table
		const tableBottom = rowY + 28;
		document.moveTo(MARGIN, tableBottom).lineTo(MARGIN + CONTENT_W, tableBottom).lineWidth(1).strokeColor("#e2e8f0").stroke();

		// ── Totals block ──────────────────────────────────────────────────────────
		const totalsX = MARGIN + CONTENT_W - 210;
		const totalsY = tableBottom + 16;
		document.rect(totalsX, totalsY, 210, 56).fill("#0f172a");
		document.fontSize(9).fillColor("#94a3b8").font("Helvetica").text("Subtotal", totalsX + 12, totalsY + 10, { width: 100 });
		document.fontSize(9).fillColor("#ffffff").font("Helvetica").text(formatMoney(record.totalAmount, record.currency), totalsX + 12, totalsY + 10, { width: 186, align: "right" });
		document.moveTo(totalsX + 12, totalsY + 28).lineTo(totalsX + 198, totalsY + 28).lineWidth(0.5).strokeColor("#334155").stroke();
		document.fontSize(11).fillColor("#38bdf8").font("Helvetica-Bold").text("Total Due", totalsX + 12, totalsY + 34, { width: 100 });
		document.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold").text(formatMoney(record.totalAmount, record.currency), totalsX + 12, totalsY + 34, { width: 186, align: "right" });

		// ── Stock trigger info ────────────────────────────────────────────────────
		const infoY = totalsY + 80;
		document.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold").text("Stock Trigger Details", MARGIN, infoY);
		document.moveTo(MARGIN, infoY + 14).lineTo(MARGIN + CONTENT_W, infoY + 14).lineWidth(0.5).strokeColor("#e2e8f0").stroke();

		const pairs = [
			["Low-stock threshold", `${record.threshold} g`],
			["Triggered weight", `${record.triggeredWeight} g`],
		];
		pairs.forEach(([label, value], i) => {
			const py = infoY + 22 + i * 18;
			document.fontSize(9).fillColor("#6b7280").font("Helvetica").text(label, MARGIN, py);
			document.fillColor("#111827").font("Helvetica").text(value, MARGIN + CONTENT_W - 160, py, { width: 160, align: "right" });
		});

		// Warehouse contact
		if (record.warehouse?.location || record.warehouse?.contactEmail) {
			const warehouseY = infoY + 22 + pairs.length * 18 + 12;
			document.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold").text("Warehouse Info", MARGIN, warehouseY);
			document.moveTo(MARGIN, warehouseY + 14).lineTo(MARGIN + CONTENT_W, warehouseY + 14).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
			let wy = warehouseY + 22;
			if (record.warehouse.location) {
				document.fontSize(9).fillColor("#6b7280").font("Helvetica").text("Location", MARGIN, wy);
				document.fillColor("#111827").text(record.warehouse.location, MARGIN + CONTENT_W - 200, wy, { width: 200, align: "right" });
				wy += 18;
			}
			if (record.warehouse.contactEmail) {
				document.fontSize(9).fillColor("#6b7280").font("Helvetica").text("Contact", MARGIN, wy);
				document.fillColor("#0ea5e9").text(record.warehouse.contactEmail, MARGIN + CONTENT_W - 200, wy, { width: 200, align: "right" });
			}
		}

		if (record.notes) {
			const notesY = document.y + 24;
			document.rect(MARGIN, notesY, CONTENT_W, 1).fill("#e2e8f0");
			document.fontSize(8).fillColor("#94a3b8").font("Helvetica-Bold").text("NOTES", MARGIN, notesY + 10, { characterSpacing: 1 });
			document.fontSize(9).fillColor("#374151").font("Helvetica").text(record.notes, MARGIN, notesY + 22, { width: CONTENT_W });
		}

		// ── Footer bar ────────────────────────────────────────────────────────────
		document.rect(0, PAGE_H - 44, PAGE_W, 44).fill("#0f172a");
		document.fontSize(8).fillColor("#64748b").font("Helvetica")
			.text("This invoice was generated automatically by IntelliRack from low-stock billing data.", MARGIN, PAGE_H - 30, { width: CONTENT_W - 80 });
		document.fillColor("#475569").text(`Page 1 of 1`, 0, PAGE_H - 30, { align: "right", width: PAGE_W - MARGIN });

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