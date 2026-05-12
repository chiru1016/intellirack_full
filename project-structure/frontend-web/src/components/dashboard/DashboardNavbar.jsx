"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components";
import GlassTabs from "@/components/GlassTabs";

export default function DashboardNavbar({ user, onSignOut, tabs, currentTab, onTabChange }) {
	const { isDark, setThemeMode } = useTheme();

	const toggleTheme = () => {
		setThemeMode(isDark ? "light" : "dark");
	};

	return (
		<div className="w-full max-w-6xl mx-auto flex items-center justify-between mb-6">
			<div className="flex items-center gap-3">
				<div className="rounded-2xl bg-white/50 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-2">
					<span className="text-2xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
						IntelliRack
					</span>
				</div>
				<GlassTabs tabs={tabs} currentTab={currentTab} onTabChange={onTabChange} glassy />
			</div>
			<div className="flex items-center gap-3">
				<Link
					href="/warehouse"
					className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-pink-500/15 transition-all hover:scale-[1.02]"
				>
					Warehouse
				</Link>

				{/* Theme Toggle Button */}
				<button
					type="button"
					onClick={toggleTheme}
					aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
					className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-100 transition-all hover:bg-white/10 dark:hover:bg-white/10 hover:scale-[1.02]"
				>
					{isDark ? (
						<SunMedium className="h-4 w-4 text-amber-300" />
					) : (
						<MoonStar className="h-4 w-4 text-slate-600" />
					)}
					<span className="hidden sm:inline">
						{isDark ? "Light Mode" : "Dark Mode"}
					</span>
					<span className="sm:hidden">{isDark ? "Light" : "Dark"}</span>
				</button>

				{/* User Info */}
				<div className="rounded-full bg-white/20 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl px-4 py-2 flex flex-col items-center">
					<span className="font-semibold text-gray-700 dark:text-slate-100">
						{typeof user?.name === "string" ? user.name : "User"}
					</span>
					<span className="text-xs text-gray-500 dark:text-slate-400">
						{typeof user?.email === "string" ? user.email : "user@example.com"}
					</span>
				</div>

				{/* Sign Out Button */}
				<Button
					onClick={onSignOut}
					className="rounded-full px-6 py-2 text-sm font-semibold shadow-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-none hover:shadow-2xl transition-all"
				>
					Sign Out
				</Button>
			</div>
		</div>
	);
}
