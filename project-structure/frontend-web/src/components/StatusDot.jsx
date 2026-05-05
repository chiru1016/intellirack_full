import React from "react";

const STATUS_COLORS = {
	GOOD: "bg-green-400",
	LOW: "bg-orange-400",
	EMPTY: "bg-red-500",
	SENSOR_ERROR: "bg-gray-400",
	RESTOCK: "bg-blue-400",
	BATCH_USAGE: "bg-purple-400",
	ANOMALY: "bg-pink-400",
	UNKNOWN: "bg-gray-300",
};

export default function StatusDot({ status = "UNKNOWN", className = "" }) {
	const color = STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN;
	return (
		<span
			className={`inline-block w-3 h-3 rounded-full mr-2 ${color} ${className}`}
		/>
	);
}
