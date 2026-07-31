import { Router } from "express";
import Settings from "../models/Settings.js";
import GalleryImage from "../models/GalleryImage.js";
import TeamMember from "../models/TeamMember.js";

import Message from "../models/Message.js";

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

// GET /api/settings/gallery — Public route to fetch gallery images
router.get("/gallery", async (req, res) => {
  try {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string) : null;
    const query = GalleryImage.find({}).sort({ createdAt: -1 });
    if (limitParam && limitParam > 0) {
      query.limit(limitParam);
    } else if (req.query.all !== "true") {
      query.limit(6);
    }
    const images = await query.lean();
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

// POST /api/settings/contact — Public route to submit a contact message
router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, error: "Name and message are required" });
    }

    const newMessage = await Message.create({
      name: name.trim(),
      email: (email || "").trim(),
      phone: (phone || "").trim(),
      message: message.trim(),
      isRead: false,
    });

    res.json({ success: true, data: newMessage, message: "Message sent successfully" });
  } catch (error) {
    console.error("Error creating contact message:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

export default router;
