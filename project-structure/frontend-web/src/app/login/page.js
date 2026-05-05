"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/auth";
import Image from "next/image";
// import rack from "@/public/rack.png";
import rack from "../../../public/images/rack.png";

export default function LoginPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ email: "", password: "" });

	async function onSubmit(event) {
		event.preventDefault();
		setIsLoading(true);
		setError("");
		try {
			await login(form.email, form.password);
			router.replace("/dashboard");
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}

	function handleChange(e) {
		setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
	}

	return (
		<div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
			<div className="relative hidden h-full flex-col bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-10 text-white lg:flex">
				<div className="relative z-20 flex items-center text-3xl font-bold">
					<span className="text-white">
						<Link href="/">IntelliRack</Link>
					</span>
				</div>
				<div className="mt-15 ">
					<Image
						src={rack}
						alt="IntelliRack"
						width={500}
						height={450}
						style={{ objectFit: "contain" }}
						// className="shadow-xl"
						priority
					/>
				</div>

				<div className="relative z-20 mt-auto text-white/95">
					<blockquote className="space-y-2">
						<p className="text-lg text-white">
							&quot;Smart inventory management for the modern world. Track,
							analyze, and optimize your stock with ease.&quot;
						</p>
						<footer className="text-sm text-white/85">Powered by IoT & AI</footer>
					</blockquote>
				</div>
			</div>
			<div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-500 lg:p-8 flex items-center justify-center p-6">
				<div className="w-full max-w-xl animate-fadein rounded-[2rem] border border-white/30 bg-white/10 p-6 backdrop-blur-2xl shadow-2xl">
					<Card className="animate-fadein border border-slate-200/15 bg-slate-900/45 text-slate-100 shadow-xl">
						<CardHeader className="space-y-3">
							<CardTitle className="text-2xl text-center text-white tracking-tight">
								Welcome back
							</CardTitle>
							<CardDescription className="text-center text-slate-100/95">
								Sign in to your IntelliRack account
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={onSubmit}>
								<div className="grid gap-4">
									<div className="grid gap-2">
										<Label htmlFor="email" className="text-white">
											Email
										</Label>
										<Input
											id="email"
											name="email"
											placeholder="name@example.com"
											type="email"
											autoCapitalize="none"
											autoComplete="email"
											autoCorrect="off"
											disabled={isLoading}
											required
											value={form.email}
											onChange={handleChange}
											className="h-11 bg-slate-800/60 border-slate-300/35 !text-white caret-white !placeholder:text-white/70 focus-visible:border-indigo-300"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="password" className="text-white">
											Password
										</Label>
										<Input
											id="password"
											name="password"
											type="password"
											placeholder="Enter your password"
											autoComplete="current-password"
											disabled={isLoading}
											required
											value={form.password}
											onChange={handleChange}
											className="h-11 bg-slate-800/60 border-slate-300/35 !text-white caret-white !placeholder:text-white/70 focus-visible:border-indigo-300"
										/>
									</div>
									{error && (
										<div className="text-rose-300 text-sm text-center">
											{error}
										</div>
									)}
									<Button
										disabled={isLoading}
										className="h-11 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 !text-white font-semibold hover:from-indigo-600 hover:via-fuchsia-600 hover:to-pink-600 hover:shadow-lg transition-all duration-200"
									>
										{isLoading && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Sign In
									</Button>
								</div>
							</form>
						</CardContent>
						<CardFooter className="flex flex-col space-y-4">
							<div className="text-sm text-slate-100/95 text-center">
								Don&apos;t have an account?{" "}
								<Link
									href="/register"
									className="text-white underline-offset-4 hover:text-indigo-100 hover:underline font-semibold"
								>
									Sign Up
								</Link>
							</div>
						</CardFooter>
					</Card>
				</div>
			</div>
		</div>
	);
}
