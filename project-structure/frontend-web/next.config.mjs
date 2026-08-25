/** @type {import('next').NextConfig} */
const nextConfig = {
	env: {
		NEXT_PUBLIC_API_URL:
			process.env.NEXT_PUBLIC_API_URL ||
			process.env.NEXT_PUBLIC_API_KEY ||
			process.env.NEXT_API_URL,
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: "http://localhost:3030/api/:path*",
			},
		];
	},
};

export default nextConfig;
