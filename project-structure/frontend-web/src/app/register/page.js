"use client";

import { useState, useEffect } from "react";
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
import { register as registerUser, login } from "@/lib/auth";
import Image from "next/image";
import rack from "../../../public/images/rack.png";
export default function RegisterPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ name: "", email: "", password: "" });

	async function onSubmit(event) {
		event.preventDefault();
		setIsLoading(true);
		setError("");
		try {
			await registerUser(form.name, form.email, form.password);
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

	// useEffect(() => {
	// 	const isLoggedIn = localStorage.getItem("isLoggedIn");
	// 	if (isLoggedIn) {
	// 		router.replace("/dashboard");
	// 	}
	// }, []);

	return (
		<div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
			<div className="relative hidden h-full flex-col bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-10 text-white lg:flex">
				<div className="relative z-20 flex items-center text-3xl font-bold">
					<span className="bg-white bg-clip-text text-transparent">
						<Link href="/"> IntelliRack</Link>
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
				<div className="relative z-20 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-lg">
							&quot;Smart inventory management for the modern world. Track,
							analyze, and optimize your stock with ease.&quot;
						</p>
						<footer className="text-sm">Powered by IoT & AI</footer>
					</blockquote>
				</div>
			</div>

			<div className="lg:p-8 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-500 w-full h-full">
				<div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[600px] sm:h-[750px] animate-fadein bg-white/90 p-6 rounded-2xl shadow-2xl border border-white/50 backdrop-blur-3xl bg-opacity-70 dark:bg-zinc-900/40 ">
					<Card className="border border-white/20 shadow-lg backdrop-blur-lg bg-white/10 m-13 animate-fadein ">
						<CardHeader className="space-y-1">
							<CardTitle className="text-2xl text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
								Create an account
							</CardTitle>
							<CardDescription className="text-center">
								Join IntelliRack and revolutionize your inventory management
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={onSubmit}>
								<div className="grid gap-4">
									<div className="grid gap-2">
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											name="name"
											placeholder="John Doe"
											type="text"
											autoCapitalize="none"
											autoComplete="name"
											autoCorrect="off"
											disabled={isLoading}
											required
											value={form.name}
											onChange={handleChange}
											className="bg-white/5 border-white/20"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="email">Email</Label>
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
											className="bg-white/5 border-white/20"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="password">Password</Label>
										<Input
											id="password"
											name="password"
											type="password"
											autoComplete="new-password"
											disabled={isLoading}
											required
											value={form.password}
											onChange={handleChange}
											className="bg-white/5 border-white/20"
										/>
									</div>
									{error && (
										<div className="text-red-500 text-sm text-center">
											{error}
										</div>
									)}
									<Button
										disabled={isLoading}
										className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-lg transition-shadow animate-bouncein"
									>
										{isLoading && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Create Account
									</Button>
								</div>
							</form>
						</CardContent>
						<CardFooter className="flex flex-col space-y-4">
							<div className="text-sm text-muted-foreground text-center">
								Already have an account?{" "}
								<Link
									href="/login"
									className="text-primary underline-offset-4 hover:underline"
								>
									Sign in
								</Link>
							</div>
						</CardFooter>
					</Card>
				</div>
			</div>
		</div>
	);
}
