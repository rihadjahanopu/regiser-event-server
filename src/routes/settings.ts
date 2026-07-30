import { Router } from "express";
import Settings from "../models/Settings.js";
import GalleryImage from "../models/GalleryImage.js";
import TeamMember from "../models/TeamMember.js";

const router = Router();

// GET /api/settings — Public route to fetch event settings
router.get("/", async (_req, res) => {
  try {
    const settings = await Settings.findOne({});
    res.json({ success: true, data: settings || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch settings" });
  }
});

// GET /api/settings/gallery — Public route to fetch gallery images (latest 6)
router.get("/gallery", async (_req, res) => {
  try {
    const images = await GalleryImage.find({}).sort({ createdAt: -1 }).limit(6).lean();
    res.json({ success: true, data: images });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch gallery images" });
  }
});

// GET /api/settings/team — Public route to fetch active team members
router.get("/team", async (_req, res) => {
  try {
    const members = await TeamMember.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch team members" });
  }
});

export default router;
