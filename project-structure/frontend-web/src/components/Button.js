import React from "react";

export default function Button({
	children,
	type = "button",
	onClick,
	variant = "default", // 'default' | 'outline' | 'ghost'
	fullWidth = false,
	className = "",
	...props
}) {
	const base =
		"inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2 h-10";
	const variants = {
		default:
			"bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)] shadow",
		outline:
			"border border-[var(--primary)] bg-transparent text-[var(--primary)] hover:bg-[var(--primary)]/10",
		ghost: "bg-transparent hover:bg-[var(--primary)]/10 text-[var(--primary)]",
	};
	return (
		<button
			type={type}
			onClick={onClick}
			className={[
				base,
				variants[variant] || variants.default,
				fullWidth ? "w-full" : "",
				className,
			].join(" ")}
			{...props}
		>
			{children}
		</button>
	);
}
