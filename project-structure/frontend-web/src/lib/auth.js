const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function login(email, password) {
	const res = await fetch(`${API_URL}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) throw new Error((await res.json()).error || "Login failed");
	const data = await res.json();
	localStorage.setItem("token", data.token);
	localStorage.setItem("user", JSON.stringify(data.user));
	localStorage.setItem("email", email);
	return data.user;
}

export async function register(name, email, password) {
	const res = await fetch(`${API_URL}/auth/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, email, password }),
	});
	if (!res.ok) throw new Error((await res.json()).error || "Register failed");
	return await res.json();
}

export async function refreshUser() {
	try {
		const token = getToken();
		if (!token) return null;

		const res = await fetch(`${API_URL}/auth/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!res.ok) {
			console.error("Failed to refresh user data");
			return null;
		}

		const userData = await res.json();
		localStorage.setItem("user", JSON.stringify(userData));
		return userData;
	} catch (error) {
		console.error("Error refreshing user data:", error);
		return null;
	}
}

export function logout() {
	localStorage.removeItem("token");
	localStorage.removeItem("user");
	localStorage.removeItem("email");
}

export function getToken() {
	return localStorage.getItem("token");
}

export function getUser() {
	try {
		const user = localStorage.getItem("user");
		const email = localStorage.getItem("email");
		if (!user) return null;

		const userData = JSON.parse(user);
		// Ensure we have both _id and id fields for compatibility
		const userWithEmail = {
			...userData,
			email: userData.email || email,
			_id: userData._id || userData.id,
			id: userData.id || userData._id,
		};

		return userWithEmail;
	} catch (error) {
		console.error("Error parsing user data:", error);
		return null;
	}
}

export function getEmail() {
	return localStorage.getItem("email");
}

export async function fetchWithAuth(url, options = {}) {
	const token = getToken();
	return fetch(url, {
		...options,
		headers: {
			...(options.headers || {}),
			Authorization: token ? `Bearer ${token}` : undefined,
		},
	});
}
export { API_URL };
