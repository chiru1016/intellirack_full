const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const NFCTag = require("../models/NFCTag");
const Device = require("../models/Device");
const auth = require("../middleware/auth");

// Get all NFC tags
router.get("/", auth, async (req, res) => {
	try {
		const tags = await NFCTag.find({ createdBy: req.user.id })
			.populate("deviceId", "name rackId")
			.sort({ createdAt: -1 });

		res.json(tags);
	} catch (error) {
		console.error("Error fetching NFC tags:", error);
		res.status(500).json({ message: "Server error" });
	}
});

// NFC tag statistics
router.get("/stats/overview", auth, async (req, res) => {
	try {
		const stats = await NFCTag.aggregate([
			{ $match: { createdBy: mongoose.Types.ObjectId(req.user.id) } },
			{
				$group: {
					_id: null,
					totalTags: { $sum: 1 },
					activeTags: {
						$sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
					},
					inactiveTags: {
						$sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
					},
					lostTags: {
						$sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] },
					},
					totalReads: { $sum: "$readCount" },
					totalWrites: { $sum: "$writeCount" },
				},
			},
		]);

		res.json(
			stats[0] || {
				totalTags: 0,
				activeTags: 0,
				inactiveTags: 0,
				lostTags: 0,
				totalReads: 0,
				totalWrites: 0,
			}
		);
	} catch (error) {
		console.error("Error fetching NFC stats:", error);
		res.status(500).json({ message: "Server error" });
	}
});

// Search NFC tags
router.get("/search/:query", auth, async (req, res) => {
	try {
		const query = req.params.query;
		const tags = await NFCTag.find({
			createdBy: req.user.id,
			$or: [
				{ ingredient: { $regex: query, $options: "i" } },
				{ uid: { $regex: query, $options: "i" } },
				{ slotId: { $regex: query, $options: "i" } },
			],
		}).populate("deviceId", "name rackId");

		res.json(tags);
	} catch (error) {
		console.error("Error searching NFC tags:", error);
		res.status(500).json({ message: "Server error" });
	}
});

// Get NFC tag by ID
router.get("/:id", auth, async (req, res) => {
	try {
		const tag = await NFCTag.findOne({
			_id: req.params.id,
			createdBy: req.user.id,
		}).populate("deviceId", "name rackId");

		if (!tag) {
			return res.status(404).json({ message: "NFC tag not found" });
		}

		res.json(tag);
	} catch (error) {
		console.error("Error fetching NFC tag:", error);
		res.status(500).json({ message: "Server error" });
	}
});

module.exports = router;
