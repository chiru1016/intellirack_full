import React from "react";

const BORDER_COLORS = {
	GOOD: "border-green-400",
	LOW: "border-orange-400",
	EMPTY: "border-red-400",
	SENSOR_ERROR: "border-gray-400",
	RESTOCK: "border-blue-400",
	BATCH_USAGE: "border-purple-400",
	ANOMALY: "border-pink-400",
	UNKNOWN: "border-gray-300",
};

export default function GradientCard({
	status = "UNKNOWN",
	children,
	className = "",
}) {
	const border = BORDER_COLORS[status] || BORDER_COLORS.UNKNOWN;
	return (
		<div
			className={`rounded-2xl bg-white/20 backdrop-blur-lg border-2 ${border} shadow-lg p-6 transition-transform hover:scale-105 ${className}`}
		>
			{children}
		</div>
	);
}
