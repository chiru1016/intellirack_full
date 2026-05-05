"use client";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
	return (
		<div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#2a1600_0%,_#120a04_42%,_#090503_100%)] px-4 sm:px-6 lg:px-8">
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute -top-24 left-[-8rem] h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
				<div className="absolute top-24 right-[-6rem] h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
				<div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl" />
			</div>
			{/* <div className="landing-bg" /> */}
			<Navbar />
			{/* Hero Section */}
			<main className="relative z-10 mt-24 w-full max-w-7xl rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] border border-white/10 bg-slate-950/65 backdrop-blur-xl shadow-2xl p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col gap-10 animate-fadein mb-12">
				<div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-12 items-center">
					<div className="space-y-6">
						<span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold tracking-wide text-amber-200">
							Smart inventory, beautifully tracked
						</span>
						<h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-white">
							Warm, fast, and responsive inventory control.
							<span className="mt-3 block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
								IntelliRack for modern teams.
							</span>
						</h1>
						<p className="max-w-2xl text-base sm:text-lg md:text-xl leading-8 text-slate-200/90">
							IntelliRack keeps shelves, ingredients, and device activity in sync with
							clear alerts and a dashboard that feels alive. Track stock in real time,
							spot shortages early, and make faster decisions from any screen size.
						</p>
						<div className="flex flex-col sm:flex-row gap-4">
							<Link
								href="/register"
								className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3.5 text-base sm:text-lg font-bold text-slate-950 shadow-xl shadow-pink-500/20 transition-transform duration-200 hover:scale-[1.02] hover:shadow-pink-500/30"
							>
								Get Started
							</Link>
							<Link
								href="#features"
								className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-base sm:text-lg font-semibold text-white/90 backdrop-blur transition-colors hover:bg-white/10"
							>
								Explore Features
							</Link>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
							{[
								{ value: "24/7", label: "Live monitoring" },
								{ value: "Instant", label: "Low-stock alerts" },
								{ value: "Mobile", label: "Responsive views" },
							].map((item) => (
								<div
									key={item.label}
									className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-lg"
								>
									<div className="text-2xl font-black text-white">{item.value}</div>
									<div className="text-sm text-slate-300">{item.label}</div>
								</div>
							))}
						</div>
					</div>
					<div className="relative">
						<div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-300/15 via-orange-400/10 to-red-400/15 blur-2xl" />
						<div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 sm:p-6 shadow-2xl">
							<div className="mb-4 flex items-center justify-between">
								<span className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200/90">
									Dashboard preview
								</span>
								<span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
									Responsive
								</span>
							</div>
							<div className="grid gap-4">
								{[
									{ title: "Stock Health", value: "98%", bar: "w-[92%]" },
									{ title: "Alerts", value: "3 active", bar: "w-[68%]" },
									{ title: "Devices Online", value: "12/12", bar: "w-[100%]" },
								].map((row) => (
									<div key={row.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<div className="flex items-center justify-between gap-4">
											<span className="text-sm font-medium text-slate-300">{row.title}</span>
											<span className="text-sm font-bold text-white">{row.value}</span>
										</div>
										<div className="mt-3 h-2 rounded-full bg-white/10">
											<div className={`h-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 ${row.bar}`} />
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Features Section */}
			<section
				className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-16 px-4"
				id="features"
			>
				{[
					{
						title: "Real-Time Inventory",
						description:
							"Track every item and its weight instantly, from kitchen to warehouse.",
					},
					{
						title: "Smart Alerts",
						description:
							"Get notified when stocks run low or items need your attention.",
					},
					{
						title: "Usage Insights",
						description:
							"See consumption patterns and optimize your inventory with data.",
					},
				].map((feature, i) => (
					<div
						key={feature.title}
						className="rounded-[2rem] bg-slate-900/75 backdrop-blur-lg border border-white/10 shadow-xl p-6 sm:p-8 flex flex-col items-center text-center animate-fadein hover:-translate-y-1 transition-transform duration-200"
						style={{ animationDelay: `${i * 0.1}s` }}
					>
						<h3 className="font-extrabold text-xl mb-2 text-white tracking-tight">
							{feature.title}
						</h3>
						<p className="text-slate-300 text-sm sm:text-base leading-7">
							{feature.description}
						</p>
					</div>
				))}
			</section>

			{/* How It Works Section */}
			<section
				id="how"
				className="w-full max-w-7xl mx-auto rounded-[2rem] bg-slate-900/75 backdrop-blur-lg border border-white/10 shadow-xl p-6 sm:p-8 md:p-12 mb-16 animate-fadein"
			>
				<h2 className="text-2xl sm:text-3xl font-black mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
					How It Works
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					{[
						{
							title: "Load Cells Measure Weight",
							description:
								"Each shelf uses precise sensors to track item weight in real time.",
						},
						{
							title: "RFID/NFC Tagging",
							description:
								"Identify every ingredient or product with a simple scan.",
						},
						{
							title: "Cloud Sync & Visualization",
							description:
								"Data is sent to your dashboard for instant access and 3D shelf views.",
						},
					].map((step) => (
						<div
							key={step.title}
							className="rounded-[1.5rem] bg-slate-950/50 backdrop-blur-lg border border-white/10 shadow-lg p-6 sm:p-8 text-center"
						>
							<p className="font-bold mb-2 text-white text-lg tracking-tight">
								{step.title}
							</p>
							<p className="text-slate-300 text-sm sm:text-base leading-7">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Tech Stack Section */}
			<section
				id="tech"
				className="w-full max-w-7xl mx-auto rounded-[2rem] bg-slate-900/75 backdrop-blur-lg border border-white/10 shadow-xl p-6 sm:p-8 md:p-12 mb-16 animate-fadein"
			>
				<h2 className="text-2xl sm:text-3xl font-black mb-6 text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
					Tech Stack
				</h2>
				<div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
					{[
						"ESP32",
						"HX711",
						"RFID/NFC",
						"Node.js",
						"MongoDB",
						"Next.js",
						"Three.js",
						"React Native",
					].map((tech) => (
						<span
							key={tech}
							className="px-4 py-2 rounded-full bg-slate-950/60 backdrop-blur-lg border border-white/10 text-slate-100 font-semibold shadow-lg text-sm sm:text-base"
						>
							{tech}
						</span>
					))}
				</div>
			</section>

			{/* Call to Action Footer */}
			<footer
				id="contact"
				className="w-full max-w-7xl mx-auto rounded-[2rem] bg-slate-900/80 backdrop-blur-lg border border-white/10 shadow-xl p-6 sm:p-8 flex flex-col items-center gap-4 mb-8 animate-fadein text-center"
			>
				<h2 className="text-xl sm:text-2xl font-black mb-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
					Ready to get started?
				</h2>
				<p className="text-slate-300 mb-4 w-full max-w-2xl text-sm sm:text-base md:text-lg leading-7">
					Experience the future of smart inventory management with IntelliRack.
					Join now and transform the way you track, manage, and optimize your
					stock!
				</p>
				<Link
					href="/register"
					className="rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3 text-base sm:text-lg font-black text-slate-950 shadow-md hover:shadow-lg transition-transform hover:scale-[1.03] animate-bouncein"
				>
					Get Started
				</Link>
			</footer>
		</div>
	);
}

// Animations (add to globals.css):
/*
@keyframes float1 {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}
@keyframes float2 {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(30px) scale(1.08); }
}
@keyframes float3 {
  0%, 100% { transform: translateX(0) scale(1); }
  50% { transform: translateX(30px) scale(1.04); }
}
@keyframes fadein {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: none; }
}
@keyframes bouncein {
  0% { transform: scale(0.9); opacity: 0; }
  60% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); }
}
*/
