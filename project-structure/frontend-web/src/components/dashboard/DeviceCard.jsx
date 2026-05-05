import React, { useState } from "react";
import Image from "next/image";
import slot from "../../../public/images/slot.png";

const DeviceCard = ({
	device,
	onDeviceClick,
	onEdit,
	onDelete,
	onViewDetails,
	alertTypes = [],
	ingredientDetails,
}) => {
	const [menuOpen, setMenuOpen] = useState(false);

	const getStatusColor = (status) => {
		switch (status) {
			case "GOOD":
				return "text-green-500";
			case "OK":
				return "text-yellow-500";
			case "LOW":
				return "text-orange-500";
			case "VLOW":
				return "text-red-500";
			case "EMPTY":
				return "text-red-600";
			default:
				return "text-gray-500";
		}
	};

	const getOnlineStatus = () => {
		if (!device.isOnline)
			return { text: "Offline", color: "text-red-500", bg: "bg-red-100" };
		const lastSeen = new Date(device.lastSeen);
		const now = new Date();
		const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));

		if (diffMinutes < 1)
			return { text: "Online", color: "text-green-500", bg: "bg-green-100" };
		if (diffMinutes < 5)
			return { text: "Online", color: "text-green-500", bg: "bg-green-100" };
		return { text: "Online", color: "text-yellow-500", bg: "bg-yellow-100" };
	};

	const formatLastSeen = (lastSeen) => {
		if (!lastSeen) return "Never";
		const date = new Date(lastSeen);
		const now = new Date();
		const diffMinutes = Math.floor((now - date) / (1000 * 60));

		if (diffMinutes < 1) return "Just now";
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		const diffHours = Math.floor(diffMinutes / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		return date.toLocaleDateString();
	};

	const onlineStatus = getOnlineStatus();

	return (
		<div
			className="relative group cursor-pointer  transition-all duration-300 hover:scale-105"
			onClick={() => onDeviceClick(device)}
		>
			{/* Glassmorphic Card */}
			<div className="relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl hover:shadow-3xl transition-all duration-300">
				{/* Gradient Overlay */}
				<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

				{/* Status Indicator */}
				<div className="flex  justify-center items-center gap-2 absolute top-3 left-3">
					<div
						className={`w-2 h-2 rounded-full ${
							device.isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"
						}`}
					/>
					<div
						className={`px-2 py-1 rounded-full text-xs font-medium ${onlineStatus.bg} ${onlineStatus.color}`}
					>
						{onlineStatus.text}
					</div>
				</div>

				{/* Device Actions Dropdown */}
				<div className="absolute top-3 right-3 z-10">
					<button
						onClick={(e) => {
							e.stopPropagation();
							setMenuOpen((open) => !open);
						}}
						className="rounded-full hover:bg-white/10 transition-colors"
					>
						<svg
							className="w-5 h-5 text-gray-300"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
						</svg>
					</button>
					{menuOpen && (
						<div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
							<button
								className="block w-full text-left px-4 py-2 hover:bg-gray-100"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen(false);
									onEdit && onEdit(device);
								}}
							>
								Edit Device
							</button>
							<button
								className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen(false);
									if (
										window.confirm(
											"Are you sure you want to delete this device?"
										)
									) {
										onDelete && onDelete(device);
									}
								}}
							>
								Delete Device
							</button>
							<button
								className="block w-full text-left px-4 py-2 hover:bg-gray-100"
								onClick={(e) => {
									e.stopPropagation();
									setMenuOpen(false);
									onViewDetails && onViewDetails(device);
								}}
							>
								View Details
							</button>
						</div>
					)}
				</div>

				{/* Alert Badges */}
				{/* {alertTypes.length > 0 && (
					<div className="absolute top-3 left-20 flex gap-1">
						{alertTypes.map((type) => (
							<span
								key={type}
								className={`px-2 py-1 rounded-full text-xs font-bold bg-red-500/80 text-white`}
							>
								{type}
							</span>
						))}
					</div>
				)} */}

				{/* Content */}
				<div className="relative py-6">
					{/* Device Image */}
					<div className="flex justify-center mb-4 w-full h-full">
						<div className="relative rounded-2xl overflow-hidden flex items-center justify-center">
							<Image
								src={slot}
								alt="Device Slot"
								width={300}
								height={300}
								className="object-cover w-full h-full rounded-2xl"
								draggable={false}
							/>
						</div>
					</div>

					{/* Device Info */}
					<div className="text-center mb-4">
						<h3 className="text-lg font-semibold text-black dark:text-white mb-1">
							{typeof device.name === "string"
								? device.name
								: `Device ${device.rackId}`}
						</h3>
						<p className="text-sm text-black dark:text-slate-300 mb-2">
							{device.ingredient || "No ingredient set"}
						</p>

						<p className="text-sm text-black dark:text-slate-300 mb-2">
							{device.location || "No location set"}
						</p>

						{/* Weight and Status */}
						<div className="space-y-2">
							<div className="text-2xl font-bold text-black dark:text-white">
								{device.weight || device.lastWeight
									? `${(device.weight || device.lastWeight).toFixed(1)}g`
									: "--"}
							</div>
							<div
								className={`text-sm font-medium ${getStatusColor(
									device.status || device.lastStatus
								)}`}
							>
								{device.status || device.lastStatus || "UNKNOWN"}
							</div>
						</div>
					</div>

					{/* Last Seen */}
					<div className="text-center">
						<p className="text-xs text-gray-600 dark:text-slate-300">
							Last seen: {formatLastSeen(device.lastSeen)}
						</p>
						{device.ipAddress && (
							<p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
								IP: {device.ipAddress}
							</p>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex  mt-4 pt-4 border-t border-white/10 items-center justify-center">
						<button
							onClick={(e) => {
								e.stopPropagation();
								onEdit && onEdit(device);
							}}
							className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm transition-colors bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg"
						>
							Device Settings
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DeviceCard;
