import { NextResponse } from "next/server";

export function middleware(request) {
	const isLoggedIn = request.cookies.get("isLoggedIn");
	const { pathname } = request.nextUrl;

	// Public paths that don't require authentication
	const publicPaths = [
		"/login",
		"/register",
		"/",
		"/dashboard",
		"/privacy",
		"/delete",
	];

	// If the user is not logged in and trying to access a protected route
	if (!isLoggedIn && !publicPaths.includes(pathname)) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// If the user is logged in and trying to access login/register pages
	if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
		return NextResponse.redirect(new URL("/dashbard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
