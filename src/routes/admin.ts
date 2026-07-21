import { Router } from "express";
import { Registration } from "../models/Registration.js";
import { Admin } from "../models/Admin.js";
import bcrypt from "bcryptjs";
import { auth } from "../config/auth.js";
import { cloudinary, upload } from "../config/cloudinary.js";
import Settings from "../models/Settings.js";

const router = Router();

// Get Dashboard Stats
router.get("/dashboard", async (req, res) => {
  try {
    const [
      totalRegistrations,
      maleCount,
      femaleCount,
      todayRegistrations,
    ] = await Promise.all([
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

    const last7Days = await Registration.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalRegistrations,
        maleCount,
        femaleCount,
        todayRegistrations,
        totalSchools,
        last7Days: last7Days.map((d: any) => ({ date: d._id, count: d.count })),
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
    const search = req.query.search as string || "";
    const status = req.query.status as string || "";

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
      Registration.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
    res.status(500).json({ success: false, error: "Failed to fetch registrations", data: [], total: 0 });
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
      return res.status(404).json({ success: false, error: "Registration not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating registration:", error);
    res.status(500).json({ success: false, error: "Failed to update registration" });
  }
});

// Delete Registration
router.delete("/registrations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await Registration.findOneAndDelete({ registrationId: id });
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Registration not found" });
    }

    res.json({ success: true, message: "Registration deleted successfully" });
  } catch (error) {
    console.error("Error deleting registration:", error);
    res.status(500).json({ success: false, error: "Failed to delete registration" });
  }
});

// Register Admin
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Use Better Auth's own signup so sessions work correctly
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });

    if (!result || !result.user) {
      return res.status(400).json({ success: false, error: "Failed to create admin" });
    }

    res.json({ success: true, message: "Admin created successfully" });
  } catch (error: any) {
    console.error("Error creating admin:", error);
    const msg = error?.body?.message || error?.message || "Failed to create admin";
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Cover Image Upload ──────────────────────────────────────────────────────
router.post("/settings/cover", upload.single("cover"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
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
    res.status(500).json({ success: false, error: "Failed to upload cover image" });
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
    res.status(500).json({ success: false, error: "Failed to delete cover image" });
  }
});

export default router;
