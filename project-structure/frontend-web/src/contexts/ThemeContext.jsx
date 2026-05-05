"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
	const [theme, setTheme] = useState("auto");
	const [isDark, setIsDark] = useState(false);

	// Load theme on mount
	useEffect(() => {
		const savedTheme = localStorage.getItem("userTheme") || "auto";
		setTheme(savedTheme);
		applyTheme(savedTheme);
	}, []);

	// Listen for system theme changes
	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (theme === "auto") {
				applyTheme("auto");
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const applyTheme = (selectedTheme) => {
		let shouldBeDark = false;

		if (selectedTheme === "dark") {
			shouldBeDark = true;
		} else if (selectedTheme === "light") {
			shouldBeDark = false;
		} else if (selectedTheme === "auto") {
			shouldBeDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		}

		setIsDark(shouldBeDark);

		// Apply to document
		const html = document.documentElement;
		if (shouldBeDark) {
			html.classList.add("dark");
		} else {
			html.classList.remove("dark");
		}
	};

	const setThemeMode = (newTheme) => {
		setTheme(newTheme);
		localStorage.setItem("userTheme", newTheme);
		applyTheme(newTheme);
	};

	return (
		<ThemeContext.Provider value={{ theme, isDark, setThemeMode }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
