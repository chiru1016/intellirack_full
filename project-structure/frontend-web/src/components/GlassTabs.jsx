import React from "react";

export default function GlassTabs({ tabs, currentTab, onTabChange }) {
	return (
		<div className="flex gap-1   px-1   w-full max-w-4xl mx-auto">
			{tabs.map((tab) => (
				<button
					key={tab}
					onClick={() => onTabChange(tab)}
					className={`px-3 py-2 rounded-full font-semibold transition-all text-xs md:text-sm
            ${
							currentTab === tab
								? "bg-neutral-50 text-black shadow-2xl shadow-black border border-black/10"
								: " text-gray-400 hover:bg-white/20 blur-xs-2xl"
						}
          `}
				>
					{tab}
				</button>
			))}
		</div>
	);
}
