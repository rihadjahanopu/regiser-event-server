import { Router } from "express";
import { auth } from "../config/auth.js";
import { cloudinary, upload } from "../config/cloudinary.js";
import { Registration } from "../models/Registration.js";
import Settings from "../models/Settings.js";
import { Certificate } from "../models/Certificate.js";

const router = Router();

// Get Dashboard Stats
router.get("/dashboard", async (req, res) => {
	try {
		const [totalRegistrations, maleCount, femaleCount, todayRegistrations] =
			await Promise.all([
				Registration.countDocuments(),
				Registration.countDocuments({ gender: "Male" }),
				Registration.countDocuments({ gender: "Female" }),
				Registration.countDocuments({
					createdAt: {
						$gte: new Date(new Date().setHours(0, 0, 0, 0)),
					},
				}),
			]);

		const schools = await Registration.distinct("schoolName");
		const totalSchools = schools.length;

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
		sevenDaysAgo.setHours(0, 0, 0, 0);

		const aggregateLast7Days = await Registration.aggregate([
			{
				$match: {
					createdAt: { $gte: sevenDaysAgo },
				},
			},
			{
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
					count: { $sum: 1 },
				},
			},
		]);

		const countsByDate = new Map<string, number>();
		aggregateLast7Days.forEach((item: any) => {
			countsByDate.set(item._id, item.count);
		});

		const last7Days = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);

			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const dayNum = String(d.getDate()).padStart(2, "0");
			const dateKey = `${year}-${month}-${dayNum}`;

			const formattedDate = d.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			});
			const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

			last7Days.push({
				date: dateKey,
				label: formattedDate,
				day: dayName,
				count: countsByDate.get(dateKey) || 0,
			});
		}

		res.json({
			success: true,
			stats: {
				totalRegistrations,
				maleCount,
				femaleCount,
				todayRegistrations,
				totalSchools,
				last7Days,
			},
		});
	} catch (error) {
		console.error("Dashboard error:", error);
		res.status(500).json({ success: false, error: "Failed to load stats" });
	}
});

// Get Registrations Table Data
router.get("/registrations", async (req, res) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";
		const status = (req.query.status as string) || "";

		const skip = (page - 1) * limit;

		let query: any = {};

		if (search) {
			query.$or = [
				{ fullName: { $regex: search, $options: "i" } },
				{ mobile: { $regex: search, $options: "i" } },
				{ registrationId: { $regex: search, $options: "i" } },
				{ schoolName: { $regex: search, $options: "i" } },
			];
		}

		if (status && status !== "All") {
			query.status = status;
		}

		const [data, total] = await Promise.all([
			Registration.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			Registration.countDocuments(query),
		]);

		res.json({
			success: true,
			data,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error("Error fetching registrations:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to fetch registrations",
				data: [],
				total: 0,
			});
	}
});
// Update Registration
router.put("/registrations/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = req.body;

		// Ensure we don't accidentally update the _id or registrationId
		delete updateData._id;
		delete updateData.registrationId;

		const updated = await Registration.findOneAndUpdate(
			{ registrationId: id },
			{ $set: updateData },
			{ new: true }
		);

		if (!updated) {
			return res
				.status(404)
				.json({ success: false, error: "Registration not found" });
		}

		res.json({ success: true, data: updated });
	} catch (error) {
		console.error("Error updating registration:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update registration" });
	}
});

// Delete Registration
router.delete("/registrations/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const deleted = await Registration.findOneAndDelete({ registrationId: id });

		if (!deleted) {
			return res
				.status(404)
				.json({ success: false, error: "Registration not found" });
		}

		res.json({ success: true, message: "Registration deleted successfully" });
	} catch (error) {
		console.error("Error deleting registration:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete registration" });
	}
});

// Delete All Registrations
router.delete("/registrations", async (req, res) => {
	try {
		await Registration.deleteMany({});
		res.json({
			success: true,
			message: "All registrations deleted successfully",
		});
	} catch (error) {
		console.error("Error deleting all registrations:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete all registrations" });
	}
});

// Register Admin
router.post("/register", async (req, res) => {
	try {
		const { name, email, password } = req.body;

		if (!name || !email || !password) {
			return res
				.status(400)
				.json({ success: false, error: "Missing required fields" });
		}

		// Use Better Auth's own signup so sessions work correctly
		const result = await auth.api.signUpEmail({
			body: { name, email, password },
		});

		if (!result || !result.user) {
			return res
				.status(400)
				.json({ success: false, error: "Failed to create admin" });
		}

		res.json({ success: true, message: "Admin created successfully" });
	} catch (error: any) {
		console.error("Error creating admin:", error);
		const msg =
			error?.body?.message || error?.message || "Failed to create admin";
		res.status(500).json({ success: false, error: msg });
	}
});

// ── Cover Image Upload ──────────────────────────────────────────────────────
router.post("/settings/cover", upload.single("cover"), async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		// Delete old image from Cloudinary if exists
		const existing = await Settings.findOne({});
		if (existing?.eventCoverPublicId) {
			await cloudinary.uploader.destroy(existing.eventCoverPublicId);
		}

		// Stream buffer to Cloudinary
		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/event", resource_type: "image" },
				(error, result) => {
					if (error) reject(error);
					else resolve(result);
				}
			);
			stream.end(req.file!.buffer);
		});

		// Upsert settings document
		const settings = await Settings.findOneAndUpdate(
			{},
			{
				eventCoverUrl: uploadResult.secure_url,
				eventCoverPublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading cover:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to upload cover image" });
	}
});

// ── Cover Image Delete ──────────────────────────────────────────────────────
router.delete("/settings/cover", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if (settings?.eventCoverPublicId) {
			await cloudinary.uploader.destroy(settings.eventCoverPublicId);
		}

		await Settings.findOneAndUpdate(
			{},
			{ eventCoverUrl: null, eventCoverPublicId: null },
			{ upsert: true }
		);

		res.json({ success: true, message: "Cover image deleted" });
	} catch (error: any) {
		console.error("Error deleting cover:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete cover image" });
	}
});

// ── President Signature Upload ──────────────────────────────────────────────
router.post("/settings/signature/president", upload.single("signature"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		// Delete old signature from Cloudinary if exists
		const existing = await Settings.findOne({});
		if ((existing as any)?.presidentSignaturePublicId) {
			await cloudinary.uploader.destroy((existing as any).presidentSignaturePublicId);
		}

		// Stream buffer to Cloudinary
		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/signatures", resource_type: "image" },
				(error, result) => {
					if (error) reject(error);
					else resolve(result);
				}
			);
			stream.end(req.file!.buffer);
		});

		const settings = await Settings.findOneAndUpdate(
			{},
			{
				presidentSignatureUrl: uploadResult.secure_url,
				presidentSignaturePublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading president signature:", error);
		res.status(500).json({ success: false, error: "Failed to upload president signature" });
	}
});

// ── President Signature Delete ──────────────────────────────────────────────
router.delete("/settings/signature/president", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if ((settings as any)?.presidentSignaturePublicId) {
			await cloudinary.uploader.destroy((settings as any).presidentSignaturePublicId);
		}
		await Settings.findOneAndUpdate(
			{},
			{ presidentSignatureUrl: "", presidentSignaturePublicId: "" },
			{ upsert: true }
		);
		res.json({ success: true, message: "President signature deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, error: "Failed to delete president signature" });
	}
});

// ── Secretary Signature Upload ──────────────────────────────────────────────
router.post("/settings/signature/secretary", upload.single("signature"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		// Delete old signature from Cloudinary if exists
		const existing = await Settings.findOne({});
		if ((existing as any)?.secretarySignaturePublicId) {
			await cloudinary.uploader.destroy((existing as any).secretarySignaturePublicId);
		}

		// Stream buffer to Cloudinary
		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/signatures", resource_type: "image" },
				(error, result) => {
					if (error) reject(error);
					else resolve(result);
				}
			);
			stream.end(req.file!.buffer);
		});

		const settings = await Settings.findOneAndUpdate(
			{},
			{
				secretarySignatureUrl: uploadResult.secure_url,
				secretarySignaturePublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading secretary signature:", error);
		res.status(500).json({ success: false, error: "Failed to upload secretary signature" });
	}
});

// ── Secretary Signature Delete ──────────────────────────────────────────────
router.delete("/settings/signature/secretary", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if ((settings as any)?.secretarySignaturePublicId) {
			await cloudinary.uploader.destroy((settings as any).secretarySignaturePublicId);
		}
		await Settings.findOneAndUpdate(
			{},
			{ secretarySignatureUrl: "", secretarySignaturePublicId: "" },
			{ upsert: true }
		);
		res.json({ success: true, message: "Secretary signature deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, error: "Failed to delete secretary signature" });
	}
});

// ── Toggle Registration Status ──────────────────────────────────────────────
router.put("/settings/status", async (req, res) => {
	try {
		const { isOpen } = req.body;

		if (typeof isOpen !== "boolean") {
			return res
				.status(400)
				.json({ success: false, error: "isOpen must be a boolean" });
		}

		const settings = await Settings.findOneAndUpdate(
			{},
			{ isRegistrationOpen: isOpen },
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error updating registration status:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to update registration status: " + error.message,
			});
	}
});

// ── Update Event Info Settings ─────────────────────────────────────────────
router.put("/settings/event", async (req, res) => {
	try {
		const {
			eventName,
			eventAddress,
			eventDate,
			eventStartTime,
			organiserContact,
			showCountdown,
			presidentName,
			presidentTitle,
			presidentSignatureUrl,
			secretaryName,
			secretaryTitle,
			secretarySignatureUrl,
		} = req.body;

		const settings = await Settings.findOneAndUpdate(
			{},
			{
				eventName: eventName ?? "",
				eventAddress: eventAddress ?? "",
				eventDate: eventDate ?? "",
				eventStartTime: eventStartTime ?? "",
				organiserContact: organiserContact ?? "",
				showCountdown:
					typeof showCountdown === "boolean" ? showCountdown : true,
				presidentName: presidentName ?? "President",
				presidentTitle: presidentTitle ?? "President, Chhatak Uttar",
				presidentSignatureUrl: presidentSignatureUrl ?? "",
				secretaryName: secretaryName ?? "General Secretary",
				secretaryTitle: secretaryTitle ?? "General Secretary, Chhatak Uttar",
				secretarySignatureUrl: secretarySignatureUrl ?? "",
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error updating event settings:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to update event settings: " + error.message,
			});
	}
});

// ── Delete/Clear Event Info Settings ───────────────────────────────────────
router.delete("/settings/event", async (_req, res) => {
	try {
		const settings = await Settings.findOneAndUpdate(
			{},
			{
				eventName: "",
				eventAddress: "",
				eventDate: "",
				eventStartTime: "",
				organiserContact: "",
				showCountdown: true,
			},
			{ upsert: true, new: true }
		);

		res.json({
			success: true,
			message: "Event details cleared",
			data: settings,
		});
	} catch (error: any) {
		console.error("Error clearing event settings:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to clear event settings" });
	}
});

// ── Update Form Field Config (Required / Optional) ─────────────────────────
router.put("/settings/field-config", async (req, res) => {
	try {
		const { fieldConfig } = req.body;

		if (!fieldConfig || typeof fieldConfig !== "object") {
			return res
				.status(400)
				.json({ success: false, error: "Invalid fieldConfig" });
		}

		const ALLOWED_FIELDS = [
			"fullName",
			"mobile",
			"email",
			"gender",
			"dob",
			"fatherName",
			"schoolName",
			"class",
			"subjectGroup",
			"rollNumber",
			"regNumber",
			"bloodGroup",
			"emergencyContact",
			"passingYear",
			"gradeGpa",
			"address",
			"district",
		];

		const sanitized: Record<string, { required: boolean; enabled: boolean }> = {};
		for (const key of ALLOWED_FIELDS) {
			const val = fieldConfig[key];
			if (typeof val === "boolean") {
				sanitized[key] = { required: val, enabled: true };
			} else if (val && typeof val === "object") {
				sanitized[key] = {
					required: Boolean(val.required),
					enabled: typeof val.enabled === "boolean" ? val.enabled : true,
				};
			} else {
				sanitized[key] = { required: false, enabled: true };
			}
		}

		const settings = await Settings.findOneAndUpdate(
			{},
			{ fieldConfig: sanitized },
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error updating field config:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to update field config: " + error.message,
			});
	}
});

// ── GET Registrations with Certificate Status ─────────────────────────────
router.get("/certificates/registrations", async (req, res) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";
		const status = (req.query.status as string) || "";
		const eventFilter = (req.query.event as string) || "Active";

		// Fetch active settings to know the active event name
		const settings = await Settings.findOne({});
		const activeEventName = settings?.eventName || "Active Event";

		let registrationIdsToFilter: string[] | null = null;

		// If filtering by a specific past event, find registrations that have a certificate for that event
		if (eventFilter !== "All" && eventFilter !== "Active" && eventFilter !== activeEventName) {
			const certs = await Certificate.find({ eventName: eventFilter }).distinct("registrationId");
			registrationIdsToFilter = certs.map((id) => String(id));
		}

		let query: any = {};
		if (search) {
			query.$or = [
				{ fullName: { $regex: search, $options: "i" } },
				{ mobile: { $regex: search, $options: "i" } },
				{ registrationId: { $regex: search, $options: "i" } },
			];
		}

		if (status && status !== "All") {
			query.status = status;
		}

		if (registrationIdsToFilter !== null) {
			query.registrationId = { $in: registrationIdsToFilter };
		}

		const skip = (page - 1) * limit;

		const [registrations, total] = await Promise.all([
			Registration.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			Registration.countDocuments(query),
		]);

		// For the fetched registrations, look up their certificates
		const regIds = registrations.map((r) => r.registrationId);
		const certificates = await Certificate.find({ registrationId: { $in: regIds } }).lean();

		const certificatesMap = new Map();
		certificates.forEach((c) => {
			certificatesMap.set(c.registrationId, c);
		});

		const data = registrations.map((r) => ({
			...r,
			certificate: certificatesMap.get(r.registrationId) || null,
		}));

		// Return unique events list for the Event Selector dropdown
		const pastEvents = await Certificate.distinct("eventName");
		const allEvents = Array.from(new Set([activeEventName, ...pastEvents])).filter(Boolean);

		res.json({
			success: true,
			data,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
			events: allEvents,
			activeEvent: {
				id: settings?._id || "active",
				name: activeEventName,
				date: settings?.eventDate || "",
				address: settings?.eventAddress || "",
				presidentName: settings?.presidentName || "President",
				presidentTitle: settings?.presidentTitle || "President, Chhatak Uttar",
				presidentSignatureUrl: settings?.presidentSignatureUrl || "",
				secretaryName: settings?.secretaryName || "General Secretary",
				secretaryTitle: settings?.secretaryTitle || "General Secretary, Chhatak Uttar",
				secretarySignatureUrl: settings?.secretarySignatureUrl || "",
			},
		});
	} catch (error: any) {
		console.error("Error fetching registrations for certificates:", error);
		res.status(500).json({ success: false, error: "Failed to fetch participants list" });
	}
});

// ── GET Certificate History ───────────────────────────────────────────────
router.get("/certificates", async (req, res) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";
		const eventFilter = (req.query.event as string) || "";

		const skip = (page - 1) * limit;

		let query: any = {};

		if (search) {
			query.$or = [
				{ fullName: { $regex: search, $options: "i" } },
				{ certificateId: { $regex: search, $options: "i" } },
				{ registrationId: { $regex: search, $options: "i" } },
			];
		}

		if (eventFilter && eventFilter !== "All") {
			query.eventName = eventFilter;
		}

		const [certificates, total] = await Promise.all([
			Certificate.find(query).sort({ generatedDate: -1 }).skip(skip).limit(limit).lean(),
			Certificate.countDocuments(query),
		]);

		res.json({
			success: true,
			data: certificates,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error: any) {
		console.error("Error fetching certificates:", error);
		res.status(500).json({ success: false, error: "Failed to fetch certificate history" });
	}
});

// ── POST Generate Certificates ────────────────────────────────────────────
router.post("/certificates/generate", async (req, res) => {
	try {
		const { registrationIds, generatedByAdmin } = req.body;

		if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
			return res.status(400).json({ success: false, error: "Missing registrationIds" });
		}

		if (!generatedByAdmin) {
			return res.status(400).json({ success: false, error: "Missing generatedByAdmin field" });
		}

		// Fetch active settings to populate event info
		const settings = await Settings.findOne({});
		if (!settings || !settings.eventName) {
			return res.status(400).json({
				success: false,
				error: "Please configure Event details in Settings before generating certificates.",
			});
		}

		const eventId = String(settings._id);
		const eventName = settings.eventName;
		const eventDate = settings.eventDate || "";
		const eventAddress = settings.eventAddress || "";

		// Fetch registrations matching the input IDs
		const registrations = await Registration.find({ registrationId: { $in: registrationIds } });

		if (registrations.length === 0) {
			return res.status(404).json({ success: false, error: "No registrations found for the provided IDs" });
		}

		const generatedCertificates = [];
		const errors = [];

		for (const reg of registrations) {
			try {
				// Check if certificate already exists for this registration ID and event name
				let cert = await Certificate.findOne({ registrationId: reg.registrationId, eventName });

				if (!cert) {
					// Generate a unique Certificate ID
					let uniqueId = "";
					let isUnique = false;
					while (!isUnique) {
						const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
						uniqueId = `CERT-${randomSuffix}`;
						const existing = await Certificate.findOne({ certificateId: uniqueId });
						if (!existing) {
							isUnique = true;
						}
					}

					cert = new Certificate({
						certificateId: uniqueId,
						registrationId: reg.registrationId,
						fullName: reg.fullName,
						eventId,
						eventName,
						eventDate,
						eventAddress,
						generatedByAdmin,
					});

					await cert.save();
				}

				generatedCertificates.push(cert);
			} catch (err: any) {
				console.error(`Error generating certificate for ${reg.registrationId}:`, err);
				errors.push({ registrationId: reg.registrationId, error: err.message });
			}
		}

		res.json({
			success: true,
			message: `Successfully generated ${generatedCertificates.length} certificates.`,
			certificates: generatedCertificates,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error: any) {
		console.error("Error in certificate generation:", error);
		res.status(500).json({ success: false, error: "Failed to generate certificates" });
	}
});

// ── DELETE Revoke/Delete Certificate ──────────────────────────────────────
router.delete("/certificates/:certificateId", async (req, res) => {
	try {
		const { certificateId } = req.params;

		const deleted = await Certificate.findOneAndDelete({ certificateId });

		if (!deleted) {
			return res.status(404).json({ success: false, error: "Certificate not found" });
		}

		res.json({ success: true, message: "Certificate revoked successfully" });
	} catch (error: any) {
		console.error("Error deleting certificate:", error);
		res.status(500).json({ success: false, error: "Failed to revoke certificate" });
	}
});

export default router;
