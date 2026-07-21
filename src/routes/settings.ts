import { Router } from "express";
import Settings from "../models/Settings";

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

export default router;
