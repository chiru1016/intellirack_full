"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Search,
	Plus,
	Edit,
	Trash2,
	Tag,
	Smartphone,
	Activity,
	CheckCircle,
	XCircle,
	AlertTriangle,
} from "lucide-react";

export default function NFCTagManager({ devices }) {
	const API_BASE = process.env.NEXT_API_URL;
	const nfcApi = (path = "") =>
		API_BASE ? `${API_BASE}/nfc${path}` : `http://localhost:3030/api/nfc${path}`;

	const [tags, setTags] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [selectedTags, setSelectedTags] = useState([]);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [editingTag, setEditingTag] = useState(null);
	const [stats, setStats] = useState({
		totalTags: 0,
		activeTags: 0,
		inactiveTags: 0,
		lostTags: 0,
		totalReads: 0,
		totalWrites: 0,
	});

	// Form state for create/edit
	const [formData, setFormData] = useState({
		uid: "",
		ingredient: "",
		deviceId: "",
		slotId: "",
		status: "active",
		metadata: {},
	});

	useEffect(() => {
		fetchTags();
		fetchStats();
	}, []);

	const fetchTags = async () => {
		try {
			const response = await fetch(nfcApi(), {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setTags(data);
			}
		} catch (error) {
			console.error("Error fetching NFC tags:", error);
		} finally {
			setLoading(false);
		}
	};

	const fetchStats = async () => {
		try {
			const response = await fetch(nfcApi("/stats/overview"), {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setStats(data);
			}
		} catch (error) {
			console.error("Error fetching NFC stats:", error);
		}
	};

	const handleCreateTag = async () => {
		try {
			const response = await fetch(nfcApi(), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				setShowCreateDialog(false);
				setFormData({
					uid: "",
					ingredient: "",
					deviceId: "",
					slotId: "",
					status: "active",
					metadata: {},
				});
				fetchTags();
				fetchStats();
			}
		} catch (error) {
			console.error("Error creating NFC tag:", error);
		}
	};

	const handleUpdateTag = async () => {
		try {
			const response = await fetch(nfcApi(`/${editingTag._id}`), {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				setShowEditDialog(false);
				setEditingTag(null);
				setFormData({
					uid: "",
					ingredient: "",
					deviceId: "",
					slotId: "",
					status: "active",
					metadata: {},
				});
				fetchTags();
				fetchStats();
			}
		} catch (error) {
			console.error("Error updating NFC tag:", error);
		}
	};

	const handleDeleteTag = async (tagId) => {
		try {
			const response = await fetch(nfcApi(`/${tagId}`), {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			if (response.ok) {
				fetchTags();
				fetchStats();
			}
		} catch (error) {
			console.error("Error deleting NFC tag:", error);
		}
	};

	const handleBulkOperation = async (operation) => {
		if (selectedTags.length === 0) return;

		try {
			const response = await fetch(nfcApi("/bulk"), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({
					operation,
					tagIds: selectedTags,
				}),
			});

			if (response.ok) {
				setSelectedTags([]);
				fetchTags();
				fetchStats();
			}
		} catch (error) {
			console.error("Error performing bulk operation:", error);
		}
	};

	const openEditDialog = (tag) => {
		setEditingTag(tag);
		setFormData({
			uid: tag.uid,
			ingredient: tag.ingredient,
			deviceId: tag.deviceId._id,
			slotId: tag.slotId,
			status: tag.status,
			metadata: tag.metadata || {},
		});
		setShowEditDialog(true);
	};

	const filteredTags = tags.filter((tag) => {
		const matchesSearch =
			tag.ingredient.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tag.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tag.slotId.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesStatus = filterStatus === "all" || tag.status === filterStatus;

		return matchesSearch && matchesStatus;
	});

	const getStatusIcon = (status) => {
		switch (status) {
			case "active":
				return <CheckCircle className="w-4 h-4 text-green-500" />;
			case "inactive":
				return <XCircle className="w-4 h-4 text-gray-500" />;
			case "lost":
				return <AlertTriangle className="w-4 h-4 text-red-500" />;
			default:
				return <Activity className="w-4 h-4 text-blue-500" />;
		}
	};

	const getStatusBadge = (status) => {
		switch (status) {
			case "active":
				return (
					<Badge variant="default" className="bg-green-500">
						Active
					</Badge>
				);
			case "inactive":
				return <Badge variant="secondary">Inactive</Badge>;
			case "lost":
				return <Badge variant="destructive">Lost</Badge>;
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-white">NFC Tag Management</h2>
					<p className="text-gray-400">
						Manage your NFC tags and track their usage
					</p>
				</div>
				<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
					<DialogTrigger asChild>
						<Button className="bg-indigo-600 hover:bg-indigo-700">
							<Plus className="w-4 h-4 mr-2" />
							Add NFC Tag
						</Button>
					</DialogTrigger>
					<DialogContent className="bg-zinc-900 border-zinc-700">
						<DialogHeader>
							<DialogTitle>Add New NFC Tag</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label htmlFor="uid">Tag UID</Label>
								<Input
									id="uid"
									value={formData.uid}
									onChange={(e) =>
										setFormData({ ...formData, uid: e.target.value })
									}
									placeholder="Enter NFC tag UID"
								/>
							</div>
							<div>
								<Label htmlFor="ingredient">Ingredient</Label>
								<Input
									id="ingredient"
									value={formData.ingredient}
									onChange={(e) =>
										setFormData({ ...formData, ingredient: e.target.value })
									}
									placeholder="Enter ingredient name"
								/>
							</div>
							<div>
								<Label htmlFor="deviceId">Device</Label>
								<Select
									value={formData.deviceId}
									onValueChange={(value) =>
										setFormData({ ...formData, deviceId: value })
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select device" />
									</SelectTrigger>
									<SelectContent>
										{devices.map((device) => (
											<SelectItem key={device._id} value={device._id}>
												{device.name} ({device.rackId})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="slotId">Slot ID</Label>
								<Input
									id="slotId"
									value={formData.slotId}
									onChange={(e) =>
										setFormData({ ...formData, slotId: e.target.value })
									}
									placeholder="Enter slot ID"
								/>
							</div>
							<div className="flex gap-2">
								<Button onClick={handleCreateTag} className="flex-1">
									Create Tag
								</Button>
								<Button
									variant="outline"
									onClick={() => setShowCreateDialog(false)}
								>
									Cancel
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Statistics Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card className="bg-white/10 border-white/20">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-gray-400">Total Tags</p>
								<p className="text-2xl font-bold text-white">
									{stats.totalTags}
								</p>
							</div>
							<Tag className="w-8 h-8 text-blue-500" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-white/10 border-white/20">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-gray-400">Active Tags</p>
								<p className="text-2xl font-bold text-green-500">
									{stats.activeTags}
								</p>
							</div>
							<CheckCircle className="w-8 h-8 text-green-500" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-white/10 border-white/20">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-gray-400">Total Reads</p>
								<p className="text-2xl font-bold text-white">
									{stats.totalReads}
								</p>
							</div>
							<Activity className="w-8 h-8 text-purple-500" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-white/10 border-white/20">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-gray-400">Total Writes</p>
								<p className="text-2xl font-bold text-white">
									{stats.totalWrites}
								</p>
							</div>
							<Smartphone className="w-8 h-8 text-orange-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters and Actions */}
			<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
				<div className="flex gap-4 flex-1">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
						<Input
							placeholder="Search tags..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>
					<Select value={filterStatus} onValueChange={setFilterStatus}>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
							<SelectItem value="lost">Lost</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{selectedTags.length > 0 && (
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("activate")}
						>
							Activate ({selectedTags.length})
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleBulkOperation("deactivate")}
						>
							Deactivate ({selectedTags.length})
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" size="sm">
									Delete ({selectedTags.length})
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent className="bg-zinc-900 border-zinc-700">
								<AlertDialogHeader>
									<AlertDialogTitle>Delete Selected Tags</AlertDialogTitle>
									<AlertDialogDescription>
										Are you sure you want to delete {selectedTags.length} NFC
										tag(s)? This action cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => handleBulkOperation("delete")}
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}
			</div>

			{/* Tags Table */}
			<Card className="bg-white/10 border-white/20">
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow className="border-white/10">
								<TableHead className="w-12">
									<input
										type="checkbox"
										checked={
											selectedTags.length === filteredTags.length &&
											filteredTags.length > 0
										}
										onChange={(e) => {
											if (e.target.checked) {
												setSelectedTags(filteredTags.map((tag) => tag._id));
											} else {
												setSelectedTags([]);
											}
										}}
									/>
								</TableHead>
								<TableHead>Tag Info</TableHead>
								<TableHead>Device & Slot</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Usage</TableHead>
								<TableHead>Last Seen</TableHead>
								<TableHead className="w-24">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredTags.map((tag) => (
								<TableRow key={tag._id} className="border-white/10">
									<TableCell>
										<input
											type="checkbox"
											checked={selectedTags.includes(tag._id)}
											onChange={(e) => {
												if (e.target.checked) {
													setSelectedTags([...selectedTags, tag._id]);
												} else {
													setSelectedTags(
														selectedTags.filter((id) => id !== tag._id)
													);
												}
											}}
										/>
									</TableCell>
									<TableCell>
										<div>
											<p className="font-medium text-white">{tag.ingredient}</p>
											<p className="text-sm text-gray-400">{tag.uid}</p>
										</div>
									</TableCell>
									<TableCell>
										<div>
											<p className="text-white">
												{tag.deviceId?.name || "Unknown"}
											</p>
											<p className="text-sm text-gray-400">Slot {tag.slotId}</p>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											{getStatusIcon(tag.status)}
											{getStatusBadge(tag.status)}
										</div>
									</TableCell>
									<TableCell>
										<div className="text-sm">
											<p>Reads: {tag.readCount}</p>
											<p>Writes: {tag.writeCount}</p>
										</div>
									</TableCell>
									<TableCell>
										<div className="text-sm text-gray-400">
											{new Date(tag.lastSeen).toLocaleDateString()}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => openEditDialog(tag)}
											>
												<Edit className="w-4 h-4" />
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="ghost" size="sm">
														<Trash2 className="w-4 h-4 text-red-500" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent className="bg-zinc-900 border-zinc-700">
													<AlertDialogHeader>
														<AlertDialogTitle>Delete NFC Tag</AlertDialogTitle>
														<AlertDialogDescription>
															Are you sure you want to delete the NFC tag for "
															{tag.ingredient}"? This action cannot be undone.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() => handleDeleteTag(tag._id)}
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{filteredTags.length === 0 && (
						<div className="text-center py-8 text-gray-400">
							<Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
							<p>No NFC tags found</p>
							<p className="text-sm">
								Create your first NFC tag to get started
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Edit Dialog */}
			<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
				<DialogContent className="bg-zinc-900 border-zinc-700">
					<DialogHeader>
						<DialogTitle>Edit NFC Tag</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="edit-ingredient">Ingredient</Label>
							<Input
								id="edit-ingredient"
								value={formData.ingredient}
								onChange={(e) =>
									setFormData({ ...formData, ingredient: e.target.value })
								}
								placeholder="Enter ingredient name"
							/>
						</div>
						<div>
							<Label htmlFor="edit-status">Status</Label>
							<Select
								value={formData.status}
								onValueChange={(value) =>
									setFormData({ ...formData, status: value })
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
									<SelectItem value="lost">Lost</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleUpdateTag} className="flex-1">
								Update Tag
							</Button>
							<Button
								variant="outline"
								onClick={() => setShowEditDialog(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
