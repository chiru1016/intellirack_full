import React from "react";

export default function Input({
	type = "text",
	value,
	onChange,
	placeholder = "",
	label = "",
	error = "",
	fullWidth = false,
	className = "",
	...props
}) {
	return (
		<div className={fullWidth ? "w-full" : ""}>
			{label && (
				<label className="block mb-1 text-sm font-medium text-[var(--foreground)]">
					{label}
				</label>
			)}
			<input
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				className={[
					"flex h-10 w-full rounded-md border bg-[var(--glass-bg)] px-3 py-2 text-sm ring-offset-background placeholder:text-[var(--foreground)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 transition",
					error ? "border-red-400" : "border-[var(--primary)]/30",
					className,
				].join(" ")}
				{...props}
			/>
			{error && <div className="text-red-500 text-xs mt-1">{error}</div>}
		</div>
	);
}
