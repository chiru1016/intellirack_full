import React, { createContext, useState, useContext, useEffect } from "react";
import { useColorScheme, AppearanceProvider } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
	const systemColorScheme = useColorScheme();
	const [theme, setTheme] = useState("auto");
	const [isDark, setIsDark] = useState(false);

	// Load theme on mount
	useEffect(() => {
		loadTheme();
	}, []);

	// Update when theme changes
	useEffect(() => {
		applyTheme(theme);
	}, [theme, systemColorScheme]);

	const loadTheme = async () => {
		try {
			const savedTheme = await AsyncStorage.getItem("userTheme");
			if (savedTheme) {
				setTheme(savedTheme);
			} else {
				setTheme("auto");
			}
		} catch (error) {
			console.error("Failed to load theme:", error);
		}
	};

	const applyTheme = (selectedTheme) => {
		let shouldBeDark = false;

		if (selectedTheme === "dark") {
			shouldBeDark = true;
		} else if (selectedTheme === "light") {
			shouldBeDark = false;
		} else if (selectedTheme === "auto") {
			shouldBeDark = systemColorScheme === "dark";
		}

		setIsDark(shouldBeDark);
	};

	const setThemeMode = async (newTheme) => {
		try {
			setTheme(newTheme);
			await AsyncStorage.setItem("userTheme", newTheme);
		} catch (error) {
			console.error("Failed to save theme:", error);
		}
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
