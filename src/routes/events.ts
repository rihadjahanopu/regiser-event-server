import { Router } from "express";
import { Event } from "../models/Event.js";

const router = Router();

// GET /api/events — Public list of all active/upcoming events
router.get("/", async (req, res) => {
  try {
    const events = await Event.find({ status: { $ne: "Draft" } })
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

// GET /api/events/:slug — Get single event by slug for registration & detail page
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const event = await Event.findOne({ slug }).lean();

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    res.json({ success: true, data: event });
  } catch (error: any) {
    console.error("Error fetching event:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
});

export default router;
