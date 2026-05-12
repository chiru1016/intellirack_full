"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function formatDate(value) {
	if (!value) return "-";
	return new Date(value).toLocaleString();
}

function formatMoney(amount, currency = "USD") {
	if (amount === null || amount === undefined) return `${currency} 0.00`;
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(Number(amount) || 0);
}

export default function WarehousePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [overview, setOverview] = useState(null);
	const [alerts, setAlerts] = useState([]);
	const [billing, setBilling] = useState([]);
	const [thresholds, setThresholds] = useState([]);
	const [form, setForm] = useState({
		deviceId: "",
		ingredient: "",
		slotId: 1,
		lowThreshold: 100,
		reorderQuantity: 1,
		unitPrice: 0,
		currency: "USD",
		autoBillEnabled: true,
	});

	const downloadBillPdf = async (billingId, invoiceNumber) => {
		const token = getToken();
		if (!token) {
			router.push("/login");
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/warehouse/billing/${billingId}/pdf`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to download bill PDF");
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${invoiceNumber || billingId}.pdf`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			setError(err.message || "Unable to generate bill PDF");
		}
	};

	const viewBillPdf = async (billingId) => {
		const token = getToken();
		if (!token) {
			router.push("/login");
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/warehouse/billing/${billingId}/pdf`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to open bill PDF");
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			window.open(url, "_blank", "noopener,noreferrer");
			setTimeout(() => window.URL.revokeObjectURL(url), 1000);
		} catch (err) {
			setError(err.message || "Unable to open bill PDF");
		}
	};

	const loadWarehouseData = async () => {
		const token = getToken();
		if (!token) {
			router.push("/login");
			return;
		}

		setLoading(true);
		setError("");
		try {
			const headers = {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			};

			const [overviewRes, alertsRes, billingRes, thresholdsRes] = await Promise.all([
				fetch(`${API_BASE}/warehouse/overview`, { headers }),
				fetch(`${API_BASE}/warehouse/alerts`, { headers }),
				fetch(`${API_BASE}/warehouse/billing`, { headers }),
				fetch(`${API_BASE}/warehouse/thresholds`, { headers }),
			]);

			if (!overviewRes.ok || !alertsRes.ok || !billingRes.ok || !thresholdsRes.ok) {
				throw new Error("Failed to load warehouse data");
			}

			setOverview(await overviewRes.json());
			setAlerts(await alertsRes.json());
			setBilling(await billingRes.json());
			setThresholds(await thresholdsRes.json());
		} catch (err) {
			setError(err.message || "Unable to load warehouse data");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadWarehouseData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSubmit = async (event) => {
		event.preventDefault();
		const token = getToken();
		if (!token) {
			router.push("/login");
			return;
		}

		setSaving(true);
		setError("");
		try {
			const response = await fetch(`${API_BASE}/warehouse/thresholds`, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...form,
					slotId: Number(form.slotId) || 1,
					lowThreshold: Number(form.lowThreshold) || 100,
					reorderQuantity: Number(form.reorderQuantity) || 1,
					unitPrice: Number(form.unitPrice) || 0,
					autoBillEnabled: Boolean(form.autoBillEnabled),
				}),
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to save threshold");
			}

			setForm((current) => ({ ...current, ingredient: "", deviceId: "" }));
			await loadWarehouseData();
		} catch (err) {
			setError(err.message || "Unable to save threshold");
		} finally {
			setSaving(false);
		}
	};

	const markBillPaid = async (billingId) => {
		const token = getToken();
		if (!token) {
			router.push("/login");
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/warehouse/billing/${billingId}/paid`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error || "Failed to mark bill as paid");
			}

			await loadWarehouseData();
		} catch (err) {
			setError(err.message || "Unable to update billing record");
		}
	};

	return (
		<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute -top-24 left-[-8rem] h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/25" />
				<div className="absolute top-24 right-[-6rem] h-80 w-80 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-500/18" />
				<div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl" />
			</div>
			<div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
				<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-2xl backdrop-blur-[30px] sm:p-8 dark:border-white/10 dark:bg-zinc-900/25">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
								Warehouse console
							</p>
							<h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
								Low-stock alerts and auto billing
							</h1>
							<p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-200/90 sm:text-base">
								This dashboard shows live low-stock notifications, auto-generated billing records,
								and threshold settings driven from the existing MQTT inventory pipeline.
							</p>
						</div>
						<button
							onClick={loadWarehouseData}
							className="rounded-full border border-white/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
						>
							Refresh
						</button>
					</div>
				</div>

				{error ? (
					<div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-700 backdrop-blur-lg dark:text-red-100">
						{error}
					</div>
				) : null}

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{[
						{ label: "Active alerts", value: overview?.counts?.activeAlerts ?? 0 },
						{ label: "Pending bills", value: overview?.counts?.activeBills ?? 0 },
						{ label: "Thresholds", value: overview?.counts?.thresholds ?? 0 },
						{ label: "Tracked devices", value: overview?.counts?.devices ?? 0 },
					].map((item) => (
						<div key={item.label} className="rounded-3xl border border-white/30 bg-white/70 p-5 shadow-lg backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
							<p className="text-sm text-slate-500 dark:text-slate-300">{item.label}</p>
							<p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{loading ? "..." : item.value}</p>
						</div>
					))}
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
					<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
						<div className="flex items-center justify-between gap-4">
							<div>
								<h2 className="text-xl font-bold text-slate-900 dark:text-white">Threshold settings</h2>
								<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set the limit that triggers the warehouse billing flow.</p>
							</div>
						</div>

						<form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
							<input className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white" placeholder="Device ID or rack ID (optional)" value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })} />
							<input className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white" placeholder="Ingredient name" value={form.ingredient} onChange={(event) => setForm({ ...form, ingredient: event.target.value })} required />
							<input type="number" min="1" className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })} />
							<input type="number" min="0" className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" value={form.lowThreshold} onChange={(event) => setForm({ ...form, lowThreshold: event.target.value })} />
							<input type="number" min="1" className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" value={form.reorderQuantity} onChange={(event) => setForm({ ...form, reorderQuantity: event.target.value })} />
							<input type="number" min="0" step="0.01" className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
							<input className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
							<label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-700 sm:col-span-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
								<input type="checkbox" checked={form.autoBillEnabled} onChange={(event) => setForm({ ...form, autoBillEnabled: event.target.checked })} />
								Auto bill on low stock
							</label>
							<button disabled={saving} className="rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-pink-500/15 transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
								{saving ? "Saving..." : "Save threshold"}
							</button>
						</form>
					</div>

					<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
						<h2 className="text-xl font-bold text-slate-900 dark:text-white">Live stock status</h2>
						<div className="mt-5 space-y-3">
							{(overview?.stockStatus || []).length === 0 ? (
								<p className="text-sm text-slate-600 dark:text-slate-300">No stock snapshots available yet.</p>
							) : (
								overview.stockStatus.map((item) => (
									<div key={item._id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-lg dark:border-white/10 dark:bg-white/5">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="font-semibold text-slate-900 dark:text-white">{item.ingredient || "Unknown ingredient"}</p>
												<p className="text-xs text-slate-500 dark:text-slate-400">{item.device ? `${item.device.name} · ${item.device.rackId}` : "No device"} · Slot {item.slotId}</p>
											</div>
											<span className="rounded-full border border-white/10 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-amber-100">{item.status || "-"}</span>
										</div>
										<div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
											<span>Weight</span>
											<span className="font-semibold text-slate-900 dark:text-white">{item.weight ?? 0} g</span>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
						<h2 className="text-xl font-bold text-slate-900 dark:text-white">Low-stock alerts</h2>
						<div className="mt-5 space-y-3">
							{alerts.length === 0 ? (
								<p className="text-sm text-slate-600 dark:text-slate-300">No active low-stock alerts.</p>
							) : (
								alerts.map((item) => (
									<div key={item._id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-lg dark:border-white/10 dark:bg-white/5">
										<p className="font-semibold text-slate-900 dark:text-white">{item.ingredient} · Slot {item.slotId}</p>
										<p className="text-xs text-slate-500 dark:text-slate-400">{item.device ? `${item.device.name} · ${item.device.rackId}` : "No device"}</p>
										<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.type} · {formatDate(item.createdAt)}</p>
									</div>
								))
							)}
						</div>
					</div>

					<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
						<h2 className="text-xl font-bold text-slate-900 dark:text-white">Billing records</h2>
						<div className="mt-5 space-y-3">
							{billing.length === 0 ? (
								<p className="text-sm text-slate-600 dark:text-slate-300">No billing records yet.</p>
							) : (
								billing.map((item) => (
									<div key={item._id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-lg dark:border-white/10 dark:bg-white/5">
										<div className="flex items-center justify-between gap-3">
											<p className="font-semibold text-slate-900 dark:text-white">{item.ingredient} · {Number(item.quantity).toFixed(2)} kg</p>
											<span className="rounded-full border border-white/10 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-amber-100">{item.status}</span>
										</div>
										<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.device ? `${item.device.name} · ${item.device.rackId}` : "No device"}</p>
										<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Total: {formatMoney(item.totalAmount, item.currency)}</p>
										<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Issued {formatDate(item.issuedAt)}</p>
										{item.invoiceNumber ? (
											<>
											<p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Invoice {item.invoiceNumber}</p>
											<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Qty {Number(item.quantity).toFixed(2)} kg</p>
											</>
										) : null}
										<div className="mt-3 flex flex-wrap gap-2">
											<button
												onClick={() => viewBillPdf(item._id)}
												className="inline-flex rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-md transition hover:scale-[1.02] hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
											>
												View
											</button>
											<button
												onClick={() => downloadBillPdf(item._id, item.invoiceNumber)}
												className="inline-flex rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-xs font-semibold text-indigo-700 shadow-md transition hover:scale-[1.02] hover:bg-indigo-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
											>
												Download PDF
											</button>
											{item.status === "PENDING" ? (
												<button
													onClick={() => markBillPaid(item._id)}
													className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md transition hover:scale-[1.02]"
												>
													Mark paid
												</button>
											) : null}
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				<div className="rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur-[30px] dark:border-white/10 dark:bg-zinc-900/25">
					<h2 className="text-xl font-bold text-slate-900 dark:text-white">Threshold catalog</h2>
					<div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{thresholds.length === 0 ? (
							<p className="text-sm text-slate-600 dark:text-slate-300">No threshold rules configured yet.</p>
						) : (
							thresholds.map((item) => (
								<div key={item._id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-lg dark:border-white/10 dark:bg-white/5">
									<p className="font-semibold text-slate-900 dark:text-white">{item.ingredient}</p>
									<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.device ? `${item.device.name} · ${item.device.rackId}` : "Global threshold"}</p>
									<p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Low threshold: <span className="font-semibold text-slate-900 dark:text-white">{item.lowThreshold}</span></p>
									<p className="text-sm text-slate-600 dark:text-slate-300">Reorder qty: <span className="font-semibold text-slate-900 dark:text-white">{item.reorderQuantity}</span></p>
									<p className="text-sm text-slate-600 dark:text-slate-300">Auto bill: <span className="font-semibold text-slate-900 dark:text-white">{item.autoBillEnabled ? "On" : "Off"}</span></p>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
