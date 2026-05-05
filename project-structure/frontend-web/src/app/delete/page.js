"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Trash2,
	AlertTriangle,
	Shield,
	Database,
	Users,
	Clock,
	CheckCircle,
	XCircle,
	Info,
	ArrowLeft,
	Home,
} from "lucide-react";

export default function DeleteAccount() {
	const [step, setStep] = useState(1);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState("");

	const handleDeleteAccount = async () => {
		if (confirmation !== "DELETE MY ACCOUNT") {
			setError("Please type the confirmation text exactly as shown");
			return;
		}

		setIsDeleting(true);
		setError("");

		try {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Success - move to final step
			setStep(4);
		} catch (err) {
			setError("Failed to delete account. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const renderStep = () => {
		switch (step) {
			case 1:
				return (
					<div className="space-y-6">
						<div className="text-center">
							<div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
								<Trash2 className="w-10 h-10 text-red-600 dark:text-red-400" />
							</div>
							<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
								Delete Your Account
							</h2>
							<p className="text-gray-600 dark:text-gray-400">
								This action cannot be undone. Please read the information below
								carefully.
							</p>
						</div>

						<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-red-800 dark:text-red-200 font-medium">
										Warning: Account deletion is permanent and irreversible.
									</p>
									<p className="text-red-700 dark:text-red-300 text-sm mt-1">
										Once deleted, you will lose access to all your data and
										cannot recover it.
									</p>
								</div>
							</div>
						</div>

						<div className="grid gap-4">
							<Card className="border-red-200 dark:border-red-800">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
										<Database className="w-4 h-4" />
										What Will Be Deleted
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
										<li>• Your account profile and settings</li>
										<li>• All connected devices and configurations</li>
										<li>• Ingredient inventory and usage history</li>
										<li>• Shopping lists and preferences</li>
										<li>• Analytics and usage data</li>
										<li>• All saved recipes and meal plans</li>
									</ul>
								</CardContent>
							</Card>

							<Card className="border-orange-200 dark:border-orange-800">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
										<Clock className="w-4 h-4" />
										Data Retention
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Some data may be retained for legal compliance purposes for
										up to 30 days after deletion.
									</p>
								</CardContent>
							</Card>

							<Card className="border-blue-200 dark:border-blue-800">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
										<Info className="w-4 h-4" />
										Before You Delete
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
										<li>• Export any data you want to keep</li>
										<li>• Cancel any active subscriptions</li>
										<li>• Download your usage history</li>
										<li>• Save important device configurations</li>
									</ul>
								</CardContent>
							</Card>
						</div>

						<div className="flex justify-center gap-4">
							<Link href="/dashboard">
								<Button variant="outline" className="flex items-center gap-2">
									<ArrowLeft className="w-4 h-4" />
									Cancel
								</Button>
							</Link>
							<Button
								variant="destructive"
								onClick={() => setStep(2)}
								className="flex items-center gap-2"
							>
								<Trash2 className="w-4 h-4" />
								Continue to Deletion
							</Button>
						</div>
					</div>
				);

			case 2:
				return (
					<div className="space-y-6">
						<div className="text-center">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
								Verify Your Identity
							</h2>
							<p className="text-gray-600 dark:text-gray-400">
								Please provide your account credentials to confirm this action.
							</p>
						</div>

						<div className="space-y-4">
							<div>
								<Label htmlFor="email">Email Address</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="Enter your email"
									className="mt-1"
								/>
							</div>
							<div>
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									className="mt-1"
								/>
							</div>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-blue-800 dark:text-blue-200 font-medium">
										Security Note
									</p>
									<p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
										Your credentials are encrypted and only used for
										verification. We do not store your password in plain text.
									</p>
								</div>
							</div>
						</div>

						<div className="flex justify-center gap-4">
							<Button
								variant="outline"
								onClick={() => setStep(1)}
								className="flex items-center gap-2"
							>
								<ArrowLeft className="w-4 h-4" />
								Back
							</Button>
							<Button
								variant="destructive"
								onClick={() => setStep(3)}
								disabled={!email || !password}
								className="flex items-center gap-2"
							>
								<Shield className="w-4 h-4" />
								Verify & Continue
							</Button>
						</div>
					</div>
				);

			case 3:
				return (
					<div className="space-y-6">
						<div className="text-center">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
								Final Confirmation
							</h2>
							<p className="text-gray-600 dark:text-gray-400">
								This is your last chance to cancel. Type the confirmation text
								to proceed.
							</p>
						</div>

						<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-red-800 dark:text-red-200 font-medium">
										Final Warning
									</p>
									<p className="text-red-700 dark:text-red-300 text-sm mt-1">
										This action will permanently delete your account and all
										associated data. This cannot be undone.
									</p>
								</div>
							</div>
						</div>

						<div className="space-y-4">
							<div>
								<Label htmlFor="confirmation">
									Type{" "}
									<span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-red-600 dark:text-red-400">
										DELETE MY ACCOUNT
									</span>{" "}
									to confirm
								</Label>
								<Input
									id="confirmation"
									type="text"
									value={confirmation}
									onChange={(e) => setConfirmation(e.target.value)}
									placeholder="DELETE MY ACCOUNT"
									className="mt-1 font-mono text-center"
								/>
							</div>

							{error && (
								<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
									<div className="flex items-center gap-3">
										<XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
										<p className="text-red-800 dark:text-red-200 text-sm">
											{error}
										</p>
									</div>
								</div>
							)}

							<div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
									<div>
										<p className="text-yellow-800 dark:text-yellow-200 font-medium">
											Processing Time
										</p>
										<p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
											Account deletion may take a few minutes to complete.
											Please do not close this page.
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className="flex justify-center gap-4">
							<Button
								variant="outline"
								onClick={() => setStep(2)}
								className="flex items-center gap-2"
							>
								<ArrowLeft className="w-4 h-4" />
								Back
							</Button>
							<Button
								variant="destructive"
								onClick={handleDeleteAccount}
								disabled={isDeleting || confirmation !== "DELETE MY ACCOUNT"}
								className="flex items-center gap-2 min-w-[140px]"
							>
								{isDeleting ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
										Deleting...
									</>
								) : (
									<>
										<Trash2 className="w-4 h-4" />
										Delete Account
									</>
								)}
							</Button>
						</div>
					</div>
				);

			case 4:
				return (
					<div className="text-center space-y-6">
						<div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
							<CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
						</div>

						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							Account Deleted Successfully
						</h2>

						<p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
							Your account has been permanently deleted. All associated data has
							been removed from our systems.
						</p>

						<div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
							<p className="text-sm text-gray-600 dark:text-gray-400">
								<strong>Note:</strong> You may need to wait up to 30 days for
								complete data removal due to legal compliance requirements.
							</p>
						</div>

						<div className="pt-4">
							<Link href="/">
								<Button className="flex items-center gap-2">
									<Home className="w-4 h-4" />
									Return to Home
								</Button>
							</Link>
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
						Account Deletion
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
						Permanently remove your account and all associated data
					</p>
				</div>

				{/* Progress Steps */}
				<div className="max-w-2xl mx-auto mb-8">
					<div className="flex items-center justify-between">
						{[
							{ step: 1, label: "Warning", icon: AlertTriangle },
							{ step: 2, label: "Verify", icon: Shield },
							{ step: 3, label: "Confirm", icon: Trash2 },
							{ step: 4, label: "Complete", icon: CheckCircle },
						].map((item, index) => {
							const Icon = item.icon;
							const isActive = step >= item.step;
							const isCompleted = step > item.step;

							return (
								<div
									key={item.step}
									className="flex flex-col items-center flex-1"
								>
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
											isCompleted
												? "bg-green-500 border-green-500 text-white"
												: isActive
												? "bg-red-500 border-red-500 text-white"
												: "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
										}`}
									>
										{isCompleted ? (
											<CheckCircle className="w-5 h-5" />
										) : (
											<Icon className="w-5 h-5" />
										)}
									</div>
									<span
										className={`text-xs mt-2 text-center ${
											isActive
												? "text-red-600 dark:text-red-400 font-medium"
												: "text-gray-500 dark:text-gray-400"
										}`}
									>
										{item.label}
									</span>
									{index < 3 && (
										<div
											className={`w-full h-0.5 mt-2 ${
												isCompleted
													? "bg-green-500"
													: "bg-gray-200 dark:bg-gray-700"
											}`}
										></div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* Main Content */}
				<div className="max-w-2xl mx-auto">
					<Card className="shadow-lg">
						<CardContent className="p-8">{renderStep()}</CardContent>
					</Card>
				</div>

				{/* Footer */}
				<div className="text-center mt-8">
					<Link href="/privacy">
						<Button variant="outline" className="mr-4">
							View Privacy Policy
						</Button>
					</Link>
					<Link href="/dashboard">
						<Button variant="outline">Back to Dashboard</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
