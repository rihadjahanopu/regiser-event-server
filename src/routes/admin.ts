import { Router } from "express";
import { auth } from "../config/auth.js";
import { cloudinary, upload } from "../config/cloudinary.js";
import { Registration } from "../models/Registration.js";
import Settings from "../models/Settings.js";
import { Certificate } from "../models/Certificate.js";
import { Event } from "../models/Event.js";
import { fromNodeHeaders } from "better-auth/node";
import mongoose from "mongoose";
import Blog from "../models/Blog.js";
import Category from "../models/Category.js";
import Tag from "../models/Tag.js";
import { Admin } from "../models/Admin.js";
import GalleryImage from "../models/GalleryImage.js";
import TeamMember from "../models/TeamMember.js";
import Message from "../models/Message.js";
import { getDb } from "../config/db.js";

const router = Router();

// Secure admin middleware (except for registration)
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session || session.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    }
    req.session = session;
    next();
  } catch (error) {
    console.error("Admin authentication check failed:", error);
    res.status(500).json({ success: false, error: "Authentication failure" });
  }
};

router.use((req, res, next) => {
  if (
    req.path === "/register" ||
    req.path === "/register/"
  ) {
    return next();
  }
  requireAdmin(req, res, next);
});

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

// ── QR Code Attendance Check-in ────────────────────────────────────────────
// POST /api/admin/attendance/scan — Scan QR Code and mark as Present
router.post("/attendance/scan", requireAdmin, async (req, res) => {
  try {
    const { qrCode } = req.body;
    if (!qrCode) {
      return res.status(400).json({ success: false, error: "QR Code data is required" });
    }

    // qrCode value equals registrationId (see registration.ts → qrCode: registrationId)
    const registration = await Registration.findOne({ registrationId: qrCode.trim() });

    if (!registration) {
      return res.status(404).json({ success: false, error: "Invalid QR Code — Registration not found" });
    }

    if (registration.attendance === "Present") {
      return res.status(409).json({
        success: false,
        alreadyCheckedIn: true,
        error: `${registration.fullName} is already marked Present at ${new Date(registration.attendedAt!).toLocaleTimeString("en-BD")}`,
        registration,
      });
    }

    registration.attendance = "Present";
    registration.attendedAt = new Date();
    await registration.save();

    res.json({
      success: true,
      message: `✅ ${registration.fullName} successfully checked in!`,
      registration,
    });
  } catch (error) {
    console.error("QR scan error:", error);
    res.status(500).json({ success: false, error: "Failed to process QR scan" });
  }
});

// GET /api/admin/attendance — Get attendance summary + list
router.get("/attendance", requireAdmin, async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const filter = (req.query.filter as string) || "All"; // All | Present | Absent
    const eventId = (req.query.eventId as string) || "";
    const eventSlug = (req.query.eventSlug as string) || "";

    let query: any = {};
    if (filter === "Present") query.attendance = "Present";
    if (filter === "Absent") query.attendance = "Absent";
    if (eventId) query.eventId = eventId;
    else if (eventSlug) query.eventSlug = eventSlug;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { registrationId: { $regex: search, $options: "i" } },
        { schoolName: { $regex: search, $options: "i" } },
      ];
    }

    const baseEventQuery: any = {};
    if (eventId) baseEventQuery.eventId = eventId;
    else if (eventSlug) baseEventQuery.eventSlug = eventSlug;

    const [registrations, totalPresent, totalAbsent, totalCount] = await Promise.all([
      Registration.find(query).sort({ attendedAt: -1, createdAt: -1 }).lean(),
      Registration.countDocuments({ ...baseEventQuery, attendance: "Present" }),
      Registration.countDocuments({ ...baseEventQuery, attendance: "Absent" }),
      Registration.countDocuments(baseEventQuery),
    ]);

    res.json({
      success: true,
      data: registrations,
      stats: { totalPresent, totalAbsent, totalCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch attendance" });
  }
});

// PATCH /api/admin/attendance/:id/reset — Reset attendance back to Absent
router.patch("/attendance/:id/reset", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reg = await Registration.findOneAndUpdate(
      { registrationId: id },
      { attendance: "Absent", attendedAt: null },
      { new: true }
    );
    if (!reg) return res.status(404).json({ success: false, error: "Registration not found" });
    res.json({ success: true, data: reg });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to reset attendance" });
  }
});

// ── Admin Events Management Endpoints ─────────────────────────────────────
// GET /api/admin/events — List all events with registration count
router.get("/events", requireAdmin, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 }).lean();

    // Get registration count for each event
    const eventsWithCount = await Promise.all(
      events.map(async (ev) => {
        const registrationCount = await Registration.countDocuments({
          $or: [{ eventId: ev._id }, { eventSlug: ev.slug }],
        });
        return { ...ev, registrationCount };
      })
    );

    res.json({ success: true, data: eventsWithCount });
  } catch (error) {
    console.error("Error fetching admin events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

// GET /api/admin/events/:id — Get single event details for admin edit
router.get("/events/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).lean();
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    const registrationCount = await Registration.countDocuments({
      $or: [{ eventId: event._id }, { eventSlug: event.slug }],
    });
    res.json({ success: true, data: { ...event, registrationCount } });
  } catch (error) {
    console.error("Error fetching admin event details:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event details" });
  }
});

// POST /api/admin/events — Create new event
router.post("/events", requireAdmin, upload.single("banner"), async (req, res) => {
  try {
    const data = typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body;

    if (!data.title) {
      return res.status(400).json({ success: false, error: "Event title is required" });
    }

    // Generate unique slug
    let slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    if (!slug) slug = "event-" + Date.now();

    const existingSlug = await Event.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    let bannerUrl = "";
    let bannerPublicId = "";

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const cRes = await cloudinary.uploader.upload(dataURI, {
        folder: "talamij_events",
      });
      bannerUrl = cRes.secure_url;
      bannerPublicId = cRes.public_id;
    }

    const newEvent = new Event({
      ...data,
      slug,
      bannerUrl,
      bannerPublicId,
    });

    await newEvent.save();
    res.json({ success: true, data: newEvent, message: "Event created successfully!" });
  } catch (error: any) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create event" });
  }
});

// PUT /api/admin/events/:id — Update event details
router.put("/events/:id", requireAdmin, upload.single("banner"), async (req, res) => {
  try {
    const { id } = req.params;
    const data = typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    if (req.file) {
      if (event.bannerPublicId) {
        await cloudinary.uploader.destroy(event.bannerPublicId).catch(() => {});
      }
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const cRes = await cloudinary.uploader.upload(dataURI, {
        folder: "talamij_events",
      });
      data.bannerUrl = cRes.secure_url;
      data.bannerPublicId = cRes.public_id;
    }

    // Update fields
    Object.assign(event, data);
    await event.save();

    res.json({ success: true, data: event, message: "Event updated successfully!" });
  } catch (error: any) {
    console.error("Error updating event:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update event" });
  }
});

// DELETE /api/admin/events/:id — Delete event
router.delete("/events/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    if (event.bannerPublicId) {
      await cloudinary.uploader.destroy(event.bannerPublicId).catch(() => {});
    }

    await Event.findByIdAndDelete(id);
    res.json({ success: true, message: "Event deleted successfully!" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ success: false, error: "Failed to delete event" });
  }
});

// Get Registrations Table Data
router.get("/registrations", async (req, res) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = (req.query.search as string) || "";
		const status = (req.query.status as string) || "";
		const eventId = (req.query.eventId as string) || "";
		const eventSlug = (req.query.eventSlug as string) || "";

		const skip = (page - 1) * limit;

		let query: any = {};

		if (eventId) query.eventId = eventId;
		else if (eventSlug) query.eventSlug = eventSlug;

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

		// Use Better Auth's own signup so sessions work correctly with role="admin"
		const result = await auth.api.signUpEmail({
			body: { name, email, password, role: "admin" } as any,
		});

		if (!result || !result.user) {
			return res
				.status(400)
				.json({ success: false, error: "Failed to create admin" });
		}

		// Explicitly set role = "admin" in user and Admin collection
		const db = await getDb();
		if (db) {
			await db.collection("user").updateOne(
				{ email },
				{ $set: { role: "admin" } }
			);
		}
		await Admin.findOneAndUpdate(
			{ email },
			{ name, email, role: "admin" },
			{ upsert: true }
		);

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

// ── Navbar Logo Upload ──────────────────────────────────────────────────────
router.post("/settings/logo", upload.single("logo"), async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		const existing = await Settings.findOne({});
		if (existing?.navbarLogoPublicId) {
			await cloudinary.uploader.destroy(existing.navbarLogoPublicId);
		}

		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/branding", resource_type: "image" },
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
				navbarLogoUrl: uploadResult.secure_url,
				navbarLogoPublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading logo:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to upload logo image" });
	}
});

// ── Navbar Logo Delete ──────────────────────────────────────────────────────
router.delete("/settings/logo", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if (settings?.navbarLogoPublicId) {
			await cloudinary.uploader.destroy(settings.navbarLogoPublicId);
		}

		await Settings.findOneAndUpdate(
			{},
			{ navbarLogoUrl: "", navbarLogoPublicId: "" },
			{ upsert: true }
		);

		res.json({ success: true, message: "Navbar logo deleted" });
	} catch (error: any) {
		console.error("Error deleting logo:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete navbar logo" });
	}
});

// ── Certificate & Ticket Watermark Image Upload ─────────────────────────────
router.post("/settings/watermark", upload.single("watermark"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		const existing = await Settings.findOne({});
		if (existing?.watermarkPublicId) {
			await cloudinary.uploader.destroy(existing.watermarkPublicId);
		}

		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/branding", resource_type: "image" },
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
				watermarkUrl: uploadResult.secure_url,
				watermarkPublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading watermark image:", error);
		res.status(500).json({ success: false, error: "Failed to upload watermark image" });
	}
});

// ── Watermark Image Delete ──────────────────────────────────────────────────
router.delete("/settings/watermark", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if (settings?.watermarkPublicId) {
			await cloudinary.uploader.destroy(settings.watermarkPublicId);
		}

		await Settings.findOneAndUpdate(
			{},
			{ watermarkUrl: "", watermarkPublicId: "" },
			{ upsert: true }
		);

		res.json({ success: true, message: "Watermark image removed" });
	} catch (error: any) {
		console.error("Error deleting watermark image:", error);
		res.status(500).json({ success: false, error: "Failed to delete watermark image" });
	}
});

// ── Dedicated Certificate Top Logo Upload ───────────────────────────────────
router.post("/settings/cert-logo", upload.single("certLogo"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		const existing = await Settings.findOne({});
		if (existing?.certTopLogoPublicId) {
			await cloudinary.uploader.destroy(existing.certTopLogoPublicId);
		}

		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/branding", resource_type: "image" },
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
				certTopLogoUrl: uploadResult.secure_url,
				certTopLogoPublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading certificate top logo:", error);
		res.status(500).json({ success: false, error: "Failed to upload certificate logo image" });
	}
});

// ── Certificate Top Logo Delete ─────────────────────────────────────────────
router.delete("/settings/cert-logo", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if (settings?.certTopLogoPublicId) {
			await cloudinary.uploader.destroy(settings.certTopLogoPublicId);
		}

		await Settings.findOneAndUpdate(
			{},
			{ certTopLogoUrl: "", certTopLogoPublicId: "" },
			{ upsert: true }
		);

		res.json({ success: true, message: "Certificate top logo removed" });
	} catch (error: any) {
		console.error("Error deleting certificate top logo:", error);
		res.status(500).json({ success: false, error: "Failed to delete certificate logo image" });
	}
});

// ── About Cover Image Upload ─────────────────────────────────────────────────
router.post("/settings/about-cover", upload.single("aboutCover"), async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ success: false, error: "No file uploaded" });
		}

		const existing = await Settings.findOne({});
		if (existing?.aboutCoverPublicId) {
			await cloudinary.uploader.destroy(existing.aboutCoverPublicId);
		}

		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/about", resource_type: "image" },
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
				aboutCoverUrl: uploadResult.secure_url,
				aboutCoverPublicId: uploadResult.public_id,
			},
			{ upsert: true, new: true }
		);

		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error uploading about cover:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to upload about cover image" });
	}
});

// ── About Cover Image Delete ─────────────────────────────────────────────────
router.delete("/settings/about-cover", async (_req, res) => {
	try {
		const settings = await Settings.findOne({});
		if (settings?.aboutCoverPublicId) {
			await cloudinary.uploader.destroy(settings.aboutCoverPublicId);
		}

		await Settings.findOneAndUpdate(
			{},
			{ aboutCoverUrl: "", aboutCoverPublicId: "" },
			{ upsert: true }
		);

		res.json({ success: true, message: "About cover image deleted" });
	} catch (error: any) {
		console.error("Error deleting about cover:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete about cover image" });
	}
});

// ── President Signature Upload ──────────────────────────────────────────────
router.post("/settings/board-member-photo", upload.single("photo"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		const uploadResult = await new Promise<any>((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ folder: "talamij/board", resource_type: "image" },
				(error, result) => {
					if (error) reject(error);
					else resolve(result);
				}
			);
			stream.end(req.file!.buffer);
		});

		res.json({
			success: true,
			data: {
				photoUrl: uploadResult.secure_url,
				photoPublicId: uploadResult.public_id,
			},
		});
	} catch (error: any) {
		console.error("Error uploading board member photo:", error);
		res.status(500).json({ success: false, error: "Failed to upload photo" });
	}
});

// ── Board Member Photo Delete ────────────────────────────────────────────────
router.delete("/settings/board-member-photo", async (req, res) => {
	try {
		const { publicId } = req.body;
		if (publicId) {
			await cloudinary.uploader.destroy(publicId);
		}
		res.json({ success: true, message: "Photo deleted" });
	} catch (error: any) {
		console.error("Error deleting board member photo:", error);
		res.status(500).json({ success: false, error: "Failed to delete photo" });
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

// ── Update Homepage Content & Visibility Settings ─────────────────────────────
router.put("/settings/homepage", async (req, res) => {
	try {
		const updateData = req.body;
		const settings = await Settings.findOneAndUpdate(
			{},
			{ $set: updateData },
			{ upsert: true, new: true }
		);
		res.json({ success: true, data: settings });
	} catch (error: any) {
		console.error("Error updating homepage settings:", error);
		res.status(500).json({
			success: false,
			error: "Failed to update homepage settings: " + error.message,
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

// ── Admin User Management ───────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.collection("user").find({}).toArray();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, error: "Role is required" });
    
    const db = await getDb();
    
    await db.collection("user").updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { role } });
    res.json({ success: true, message: "User role updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update role" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    await db.collection("user").deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    await db.collection("session").deleteMany({ userId: id });
    await db.collection("account").deleteMany({ userId: id });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

// ── Admin Blog Review ───────────────────────────────────────────────────────
router.get("/blogs/review", async (req, res) => {
  try {
    const blogs = await Blog.find({ status: { $in: ["Reviewing", "Pending"] } })
      .populate("author", "name email image")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch blogs for review" });
  }
});

router.post("/blogs/review/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(id, { status: "Published", rejectionReason: null }, { new: true });
    if (!blog) return res.status(404).json({ success: false, error: "Blog not found" });
    res.json({ success: true, message: "Blog approved & published!", data: blog });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to approve blog" });
  }
});

router.post("/blogs/review/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const blog = await Blog.findByIdAndUpdate(id, { status: "Rejected", rejectionReason: reason }, { new: true });
    if (!blog) return res.status(404).json({ success: false, error: "Blog not found" });
    res.json({ success: true, message: "Blog rejected successfully", data: blog });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to reject blog" });
  }
});

// ── Admin Blog Management ───────────────────────────────────────────────────
router.get("/blogs/published", async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "Published" })
      .populate("author", "name email image")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch published blogs" });
  }
});

router.delete("/blogs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Blog.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, error: "Blog not found" });
    res.json({ success: true, message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete blog" });
  }
});

// ── Admin Categories & Tags CRUD ───────────────────────────────────────────
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Category name is required" });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const category = await Category.create({ name, slug });
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to create category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Category.findByIdAndDelete(id);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete category" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    const tags = await Tag.find({}).sort({ name: 1 });
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch tags" });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Tag name is required" });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const tag = await Tag.create({ name, slug });
    res.status(201).json({ success: true, data: tag });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to create tag" });
  }
});

router.delete("/tags/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Tag.findByIdAndDelete(id);
    res.json({ success: true, message: "Tag deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete tag" });
  }
});

// ── Admin Comments Management ────────────────────────────────────────────────
router.get("/comments", async (req, res) => {
  try {
    // Find all blogs and extract comments with blog info
    const blogs = await Blog.find({ "comments.0": { $exists: true } }).select("title comments slug");
    const commentsList = blogs.flatMap(b => b.comments.map((c: any) => ({
      id: c._id || (c as any).id,
      blogId: b._id,
      blogTitle: b.title,
      blogSlug: b.slug,
      userName: c.userName,
      userImage: c.userImage,
      content: c.content,
      createdAt: c.createdAt
    })));
    res.json({ success: true, data: commentsList });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch comments" });
  }
});

router.delete("/comments/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    // Pull the comment from whichever blog contains it
    await Blog.updateOne(
      { "comments._id": commentId },
      { $pull: { comments: { _id: commentId } } }
    );
    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete comment" });
  }
});

// ── Admin Sessions ──────────────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  try {
    const userId = req.session!.user.id;
    const db = await getDb();

    const sessions = await db.collection("session").find({ userId }).sort({ createdAt: -1 }).toArray();
    const currentToken = (req.session!.session as any).token;

    const data = sessions.map((s: any) => ({
      id: s._id || s.id,
      userAgent: s.userAgent || "Unknown Device",
      ipAddress: s.ipAddress || "Unknown IP",
      createdAt: s.createdAt,
      isCurrent: s.token === currentToken
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch admin sessions" });
  }
});

router.post("/sessions/revoke-all", async (req, res) => {
  try {
    const userId = req.session!.user.id;
    const currentToken = (req.session!.session as any).token;
    const db = await getDb();

    await db.collection("session").deleteMany({ userId, token: { $ne: currentToken } });
    res.json({ success: true, message: "Logged out from all other devices successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to logout other devices" });
  }
});

// ─── Gallery Routes ───────────────────────────────────────────────────────────

// GET /api/admin/gallery — Fetch all gallery images
router.get("/gallery", async (_req, res) => {
  try {
    const images = await GalleryImage.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: images });
  } catch (error) {
    console.error("Error fetching gallery images:", error);
    res.status(500).json({ success: false, error: "Failed to fetch gallery images" });
  }
});

// POST /api/admin/gallery/upload — Upload image to Cloudinary + save to DB
router.post("/gallery/upload", upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file provided" });
    }

    const { title, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, error: "Title and category are required" });
    }

    // Upload buffer to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "gallery", resource_type: "image" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    const newImage = await GalleryImage.create({
      title,
      category,
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });

    res.json({ success: true, data: newImage });
  } catch (error) {
    console.error("Error uploading gallery image:", error);
    res.status(500).json({ success: false, error: "Failed to upload image" });
  }
});

// DELETE /api/admin/gallery/:id — Delete from Cloudinary + DB
router.delete("/gallery/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const image = await GalleryImage.findById(id);
    if (!image) {
      return res.status(404).json({ success: false, error: "Image not found" });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(image.publicId);

    // Delete from DB
    await GalleryImage.findByIdAndDelete(id);

    res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting gallery image:", error);
    res.status(500).json({ success: false, error: "Failed to delete image" });
  }
});

// ─── Team Member Routes ───────────────────────────────────────────────────────

// GET /api/admin/team — Fetch all team members
router.get("/team", requireAdmin, async (_req, res) => {
  try {
    const members = await TeamMember.find({}).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch team members" });
  }
});

// POST /api/admin/team — Create a team member (with optional image & signature)
router.post("/team", requireAdmin, upload.fields([{ name: "image", maxCount: 1 }, { name: "signature", maxCount: 1 }]), async (req: any, res) => {
  try {
    const { name, role, designation, order } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, error: "Name and role are required" });
    }

    let imageUrl = "";
    let publicId = "";
    let signatureUrl = "";
    let signaturePublicId = "";

    // Upload photo
    if (req.files?.image?.[0]) {
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "team", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(req.files.image[0].buffer);
      });
      imageUrl = result.secure_url;
      publicId = result.public_id;
    }

    // Upload signature
    if (req.files?.signature?.[0]) {
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "team/signatures", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(req.files.signature[0].buffer);
      });
      signatureUrl = result.secure_url;
      signaturePublicId = result.public_id;
    }

    const member = await TeamMember.create({
      name,
      role,
      designation: designation || "",
      imageUrl,
      publicId,
      signatureUrl,
      signaturePublicId,
      order: order ? parseInt(order) : 0,
    });

    res.json({ success: true, data: member });
  } catch (error) {
    console.error("Error creating team member:", error);
    res.status(500).json({ success: false, error: "Failed to create team member" });
  }
});

// PUT /api/admin/team/:id — Update a team member
router.put("/team/:id", requireAdmin, upload.fields([{ name: "image", maxCount: 1 }, { name: "signature", maxCount: 1 }]), async (req: any, res) => {
  try {
    const { id } = req.params;
    const member = await TeamMember.findById(id);
    if (!member) return res.status(404).json({ success: false, error: "Member not found" });

    const { name, role, designation, order, isActive } = req.body;
    if (name) member.name = name;
    if (role) member.role = role;
    if (designation !== undefined) member.designation = designation;
    if (order !== undefined) member.order = parseInt(order);
    if (isActive !== undefined) member.isActive = isActive === "true" || isActive === true;

    // Replace photo
    if (req.files?.image?.[0]) {
      if (member.publicId) await cloudinary.uploader.destroy(member.publicId);
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "team", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(req.files.image[0].buffer);
      });
      member.imageUrl = result.secure_url;
      member.publicId = result.public_id;
    }

    // Replace signature
    if (req.files?.signature?.[0]) {
      if (member.signaturePublicId) await cloudinary.uploader.destroy(member.signaturePublicId);
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "team/signatures", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(req.files.signature[0].buffer);
      });
      member.signatureUrl = result.secure_url;
      member.signaturePublicId = result.public_id;
    }

    await member.save();
    res.json({ success: true, data: member });
  } catch (error) {
    console.error("Error updating team member:", error);
    res.status(500).json({ success: false, error: "Failed to update team member" });
  }
});

// DELETE /api/admin/team/:id — Delete a team member
router.delete("/team/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await TeamMember.findById(id);
    if (!member) return res.status(404).json({ success: false, error: "Member not found" });

    if (member.publicId) await cloudinary.uploader.destroy(member.publicId);
    if (member.signaturePublicId) await cloudinary.uploader.destroy(member.signaturePublicId);
    await TeamMember.findByIdAndDelete(id);

    res.json({ success: true, message: "Team member deleted" });
  } catch (error) {
    console.error("Error deleting team member:", error);
    res.status(500).json({ success: false, error: "Failed to delete team member" });
  }
});

// GET /api/admin/messages — Fetch all contact messages
router.get("/messages", requireAdmin, async (_req, res) => {
  try {
    const messages = await Message.find({}).sort({ createdAt: -1 }).lean();
    const unreadCount = await Message.countDocuments({ isRead: false });
    res.json({ success: true, data: messages, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

// GET /api/admin/messages/unread-count — For realtime notification badge & toast
router.get("/messages/unread-count", requireAdmin, async (_req, res) => {
  try {
    const unreadCount = await Message.countDocuments({ isRead: false });
    const latestUnread = await Message.findOne({ isRead: false }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, unreadCount, latestUnread });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch unread count" });
  }
});

// PATCH /api/admin/messages/:id/read — Mark single message as read
router.patch("/messages/:id/read", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await Message.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ success: false, error: "Message not found" });
    res.json({ success: true, data: msg });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update message" });
  }
});

// PATCH /api/admin/messages/read-all — Mark all messages as read
router.patch("/messages/read-all", requireAdmin, async (_req, res) => {
  try {
    await Message.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true, message: "All messages marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark all as read" });
  }
});

// DELETE /api/admin/messages/:id — Delete a message
router.delete("/messages/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndDelete(id);
    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete message" });
  }
});

export default router;
