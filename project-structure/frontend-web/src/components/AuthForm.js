"use client";

import React, { useState } from "react";
import Input from "./Input";
import Button from "./Button";

export default function AuthForm({
	mode = "login", // 'login' | 'register'
	onSubmit,
	loading = false,
	error = "",
	buttonText,
	children,
	className = "",
	style = {},
}) {
	const [form, setForm] = useState({
		email: "",
		password: "",
		...(mode === "register" ? { name: "" } : {}),
	});

	function handleChange(e) {
		setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
	}

	function handleSubmit(e) {
		e.preventDefault();
		if (onSubmit) onSubmit(form);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={[
				"w-full max-w-md mx-auto rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--primary)]/20 shadow p-8 flex flex-col gap-4 animate-fadein",
				className,
			].join(" ")}
			style={style}
		>
			<h2 className="text-xl font-bold mb-2 text-[var(--primary)] text-center">
				{mode === "login" ? "Sign In" : "Create Account"}
			</h2>
			{mode === "register" && (
				<Input
					label="Name"
					name="name"
					value={form.name}
					onChange={handleChange}
					placeholder="Your name"
					required
				/>
			)}
			<Input
				label="Email"
				name="email"
				type="email"
				value={form.email}
				onChange={handleChange}
				placeholder="you@email.com"
				required
			/>
			<Input
				label="Password"
				name="password"
				type="password"
				value={form.password}
				onChange={handleChange}
				placeholder="Password"
				required
			/>
			{error && <div className="text-red-500 text-sm text-center">{error}</div>}
			<Button type="submit" fullWidth disabled={loading}>
				{loading
					? "Loading..."
					: buttonText || (mode === "login" ? "Sign In" : "Register")}
			</Button>
			{children}
		</form>
	);
}
