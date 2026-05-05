import React from "react";

export default function CloseButton({ onClick }) {
	return (
		<button
			onClick={onClick}
			className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 focus:outline-none"
			aria-label="Close"
		>
			<svg
				className="w-6 h-6 text-gray-700"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	);
}
