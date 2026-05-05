import React from "react";
import { Button } from "@/components";

export default function ProfileWidget({ user }) {
	return (
		<div className="rounded-3xl bg-white/15 dark:bg-zinc-900/25 backdrop-blur-[30px] border border-white/30 shadow-2xl p-6 flex flex-col gap-4 items-center">
			<h3 className="text-lg font-semibold mb-2 text-[var(--primary)]">
				Profile
			</h3>
			<div className="flex flex-col gap-1 items-center">
				<span className="font-bold text-lg">
					{typeof user.name === "string" ? user.name : "User"}
				</span>
				<span className="text-xs text-gray-500 dark:text-slate-300">
					{typeof user.email === "string" ? user.email : "user@example.com"}
				</span>
			</div>
			<Button className="w-fit rounded-full px-6 py-2 text-sm font-semibold shadow bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-none hover:shadow-xl transition-all">
				Edit Profile
			</Button>
		</div>
	);
}
