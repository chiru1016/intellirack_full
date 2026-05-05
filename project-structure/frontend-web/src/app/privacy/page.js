"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Shield,
	Lock,
	Eye,
	Database,
	Users,
	Globe,
	Mail,
	ExternalLink,
} from "lucide-react";

export default function PrivacyPolicy() {
	const [activeSection, setActiveSection] = useState("overview");

	const sections = [
		{ id: "overview", title: "Overview", icon: Shield },
		{ id: "data-collection", title: "Data Collection", icon: Database },
		{ id: "data-usage", title: "Data Usage", icon: Eye },
		{ id: "data-sharing", title: "Data Sharing", icon: Users },
		{ id: "security", title: "Security", icon: Lock },
		{ id: "your-rights", title: "Your Rights", icon: Shield },
		{ id: "contact", title: "Contact Us", icon: Mail },
	];

	const renderSection = () => {
		switch (activeSection) {
			case "overview":
				return (
					<div className="space-y-6">
						<div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
							<h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
								Your Privacy Matters
							</h2>
							<p className="text-blue-800 dark:text-blue-200 leading-relaxed">
								At IntelliRack, we believe in complete transparency about how we
								collect, use, and protect your data. This privacy policy
								explains your rights and our responsibilities in clear, simple
								terms.
							</p>
						</div>

						<div className="grid md:grid-cols-2 gap-6">
							<Card className="border-green-200 dark:border-green-800">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
										<Shield className="w-5 h-5" />
										Data Protection
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Your data is encrypted in transit and at rest using
										industry-standard security protocols.
									</p>
								</CardContent>
							</Card>

							<Card className="border-purple-200 dark:border-purple-800">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
										<Lock className="w-5 h-5" />
										No Third-Party Sharing
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										We never sell, rent, or share your personal data with third
										parties without your explicit consent.
									</p>
								</CardContent>
							</Card>
						</div>

						<div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
							<p className="text-sm text-yellow-800 dark:text-yellow-200">
								<strong>Last Updated:</strong> August 14, 2025
							</p>
						</div>
					</div>
				);

			case "data-collection":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							What Data We Collect
						</h2>

						<div className="grid gap-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-lg">Account Information</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Mail className="w-4 h-4 text-blue-500" />
										<span className="text-sm">Email address</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Users className="w-4 h-4 text-green-500" />
										<span className="text-sm">First and last name</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-lg">Usage Data</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Database className="w-4 h-4 text-purple-500" />
										<span className="text-sm">
											Device information and IP address
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Eye className="w-4 h-4 text-orange-500" />
										<span className="text-sm">
											App usage patterns and preferences
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-lg">Kitchen Data</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Shield className="w-4 h-4 text-indigo-500" />
										<span className="text-sm">
											Ingredient inventory and usage
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Globe className="w-4 h-4 text-teal-500" />
										<span className="text-sm">
											Device status and sensor data
										</span>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				);

			case "data-usage":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							How We Use Your Data
						</h2>

						<div className="grid gap-4">
							{[
								{
									title: "Service Provision",
									description:
										"To provide and maintain our smart kitchen management service",
									icon: Shield,
									color: "blue",
								},
								{
									title: "Account Management",
									description: "To manage your registration and account access",
									icon: Users,
									color: "green",
								},
								{
									title: "Communication",
									description:
										"To contact you about service updates and important information",
									icon: Mail,
									color: "purple",
								},
								{
									title: "Service Improvement",
									description:
										"To analyze usage patterns and improve our service",
									icon: Eye,
									color: "orange",
								},
							].map((item, index) => (
								<Card
									key={index}
									className={`border-${item.color}-200 dark:border-${item.color}-800`}
								>
									<CardHeader className="pb-3">
										<CardTitle
											className={`flex items-center gap-2 text-${item.color}-700 dark:text-${item.color}-300`}
										>
											<item.icon className="w-5 h-5" />
											{item.title}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											{item.description}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				);

			case "data-sharing":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							Data Sharing & Protection
						</h2>

						<div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-xl border border-red-200 dark:border-red-800">
							<h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-3">
								We Never Sell Your Data
							</h3>
							<p className="text-red-700 dark:text-red-300 text-sm">
								Your personal information is never sold, rented, or shared with
								third parties for marketing purposes.
							</p>
						</div>

						<div className="grid gap-4">
							<Card className="border-green-200 dark:border-green-800">
								<CardHeader>
									<CardTitle className="text-green-700 dark:text-green-300">
										Service Providers
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
										We may share data with trusted service providers who help us
										operate our service:
									</p>
									<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
										<li>• Cloud hosting providers (AWS, Google Cloud)</li>
										<li>• Analytics services (Google Analytics)</li>
										<li>• Customer support tools</li>
									</ul>
								</CardContent>
							</Card>

							<Card className="border-blue-200 dark:border-blue-800">
								<CardHeader>
									<CardTitle className="text-blue-700 dark:text-blue-300">
										Legal Requirements
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										We may disclose data if required by law or to protect our
										rights and safety.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				);

			case "security":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							Data Security
						</h2>

						<div className="grid gap-6">
							<Card className="border-indigo-200 dark:border-indigo-800">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
										<Lock className="w-5 h-5" />
										Encryption & Protection
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
										<Shield className="w-4 h-4 text-indigo-500" />
										<span className="text-sm">
											End-to-end encryption for all data transmission
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
										<Database className="w-4 h-4 text-indigo-500" />
										<span className="text-sm">
											Secure data storage with AES-256 encryption
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
										<Users className="w-4 h-4 text-indigo-500" />
										<span className="text-sm">
											Regular security audits and penetration testing
										</span>
									</div>
								</CardContent>
							</Card>

							<Card className="border-green-200 dark:border-green-800">
								<CardHeader>
									<CardTitle className="text-green-700 dark:text-green-300">
										Access Controls
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
										We implement strict access controls and authentication
										measures:
									</p>
									<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
										<li>• Multi-factor authentication</li>
										<li>• Role-based access control</li>
										<li>• Regular access reviews</li>
										<li>• Secure API endpoints</li>
									</ul>
								</CardContent>
							</Card>
						</div>
					</div>
				);

			case "your-rights":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							Your Privacy Rights
						</h2>

						<div className="grid gap-4">
							{[
								{
									title: "Access Your Data",
									description:
										"Request a copy of all personal data we have about you",
									icon: Eye,
									color: "blue",
								},
								{
									title: "Correct Your Data",
									description: "Update or correct any inaccurate information",
									icon: Database,
									color: "green",
								},
								{
									title: "Delete Your Data",
									description: "Request deletion of your personal data",
									icon: Shield,
									color: "red",
								},
								{
									title: "Data Portability",
									description: "Export your data in a machine-readable format",
									icon: Globe,
									color: "purple",
								},
							].map((item, index) => (
								<Card
									key={index}
									className={`border-${item.color}-200 dark:border-${item.color}-800`}
								>
									<CardHeader className="pb-3">
										<CardTitle
											className={`flex items-center gap-2 text-${item.color}-700 dark:text-${item.color}-300`}
										>
											<item.icon className="w-5 h-5" />
											{item.title}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											{item.description}
										</p>
									</CardContent>
								</Card>
							))}
						</div>

						<div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								<strong>To exercise these rights:</strong> Contact us at{" "}
								<a
									href="mailto:judesonleo3@gmail.com"
									className="underline hover:text-blue-600"
								>
									judesonleo3@gmail.com
								</a>
							</p>
						</div>
					</div>
				);

			case "contact":
				return (
					<div className="space-y-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							Contact Us
						</h2>

						<div className="grid gap-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Mail className="w-5 h-5 text-blue-500" />
										Get in Touch
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Mail className="w-4 h-4 text-blue-500" />
										<span className="text-sm">
											Email:{" "}
											<a
												href="mailto:judesonleo3@gmail.com"
												className="text-blue-600 hover:underline"
											>
												judesonleo3@gmail.com
											</a>
										</span>
									</div>
									<div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
										<Globe className="w-4 h-4 text-green-500" />
										<span className="text-sm">
											Website:{" "}
											<a
												href="https://intellirack.judesonleo.dev/"
												target="_blank"
												rel="noopener noreferrer"
												className="text-green-600 hover:underline flex items-center gap-1"
											>
												intellirack.judesonleo.dev
												<ExternalLink className="w-3 h-3" />
											</a>
										</span>
									</div>
								</CardContent>
							</Card>

							<div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
								<p className="text-sm text-yellow-800 dark:text-yellow-200">
									<strong>Response Time:</strong> We typically respond to
									privacy-related inquiries within 24-48 hours.
								</p>
							</div>
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-950">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
						Privacy Policy
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
						Transparent, secure, and user-focused data protection for your smart
						kitchen
					</p>
				</div>

				<div className="grid lg:grid-cols-4 gap-8">
					{/* Sidebar Navigation */}
					<div className="lg:col-span-1">
						<Card className="sticky top-8">
							<CardHeader>
								<CardTitle className="text-lg">Quick Navigation</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								{sections.map((section) => {
									const Icon = section.icon;
									return (
										<button
											key={section.id}
											onClick={() => setActiveSection(section.id)}
											className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
												activeSection === section.id
													? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
													: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
											}`}
										>
											<Icon className="w-4 h-4" />
											{section.title}
										</button>
									);
								})}
							</CardContent>
						</Card>
					</div>

					{/* Main Content */}
					<div className="lg:col-span-3">
						<Card>
							<CardContent className="p-8">{renderSection()}</CardContent>
						</Card>
					</div>
				</div>

				{/* Footer */}
				<div className="text-center mt-12">
					<Link href="/dashboard">
						<Button variant="outline" className="mr-4">
							Back to Dashboard
						</Button>
					</Link>
					<Link href="/delete">
						<Button variant="destructive">Delete Account</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
