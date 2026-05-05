import React from "react";

export default function DashboardLayout({ children }) {
	return (
		<div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 py-8 px-2">
			{children}
		</div>
	);
}
