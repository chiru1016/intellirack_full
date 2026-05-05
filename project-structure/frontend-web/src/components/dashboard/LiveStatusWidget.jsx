import React from "react";

export default function LiveStatusWidget({ liveStatus }) {
	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-6 flex flex-col gap-4">
			<h3 className="text-lg font-semibold mb-2 text-[var(--primary)]">
				Live Device Status
			</h3>
			{Object.keys(liveStatus).length === 0 && (
				<div className="text-gray-500 dark:text-slate-300">No live data yet.</div>
			)}
			<ul className="space-y-2 max-h-56 overflow-y-auto">
				{Object.entries(liveStatus).map(([deviceId, slots]) => (
					<li
						key={deviceId}
						className="rounded-xl bg-white/20 p-3 border border-white/30 shadow flex flex-col"
					>
						<span className="font-semibold">Device: {deviceId}</span>
						{Object.entries(slots).map(([slotId, s]) => (
							<div key={slotId} className="text-xs mb-1">
								<span className="font-medium">Slot {slotId}:</span>{" "}
								{s.ingredient || "-"} | {s.weight ?? "-"}g | {s.status || "-"}
							</div>
						))}
					</li>
				))}
			</ul>
		</div>
	);
}
