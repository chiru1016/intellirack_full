"use client";

import Link from "next/link";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function Navbar() {
	const { isDark, setThemeMode } = useTheme();

	const toggleTheme = () => {
		setThemeMode(isDark ? "light" : "dark");
	};

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 mx-auto max-w-7xl px-6 py-4">
			<div className="flex items-center justify-between rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 sm:px-8 sm:py-4 backdrop-blur-xl shadow-xl">
				<Link href="/" className="flex items-center gap-2">
					<span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
						IntelliRack
					</span>
				</Link>

				<div className="flex items-center gap-2 sm:gap-3 md:gap-8">
					<ul className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
						<li>
							<Link
								href="#features"
								className="hover:text-amber-200 transition-colors"
							>
								Features
							</Link>
						</li>
						<li>
							<Link
								href="#how"
								className="hover:text-amber-200 transition-colors"
							>
								How it Works
							</Link>
						</li>
						<li>
							<Link
								href="#tech"
								className="hover:text-amber-200 transition-colors"
							>
								Tech Stack
							</Link>
						</li>
						<li>
							<Link
								href="#contact"
								className="hover:text-amber-200 transition-colors"
							>
								Contact
							</Link>
						</li>
					</ul>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
						className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-100 transition-all hover:bg-white/10 hover:scale-[1.02]"
					>
						{isDark ? <SunMedium className="h-4 w-4 text-amber-300" /> : <MoonStar className="h-4 w-4 text-amber-200" />}
						<span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
						<span className="sm:hidden">{isDark ? "Light" : "Dark"}</span>
					</button>
					<Link
						href="/login"
						className="rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 sm:px-6 py-2.5 text-sm font-bold text-slate-950 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
					>
						Sign In
					</Link>
				</div>
			</div>
		</nav>
	);
}
