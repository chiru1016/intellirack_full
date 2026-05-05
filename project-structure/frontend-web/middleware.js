import { NextResponse } from "next/server";

export function middleware(request) {
	const isAuth = request.cookies.get("auth")?.value === "true";

	if (request.nextUrl.pathname.startsWith("/protected") && !isAuth) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/protected/:path*"],
};
