import { Router } from "express";
import { Registration } from "../models/Registration.js";

const router = Router();

function generateTicketNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "TKT-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Register a participant
router.post("/register", async (req, res) => {
  try {
    const data = req.body;
    
    // Zod validation could be added here similar to frontend
    
    const existingUser = await Registration.findOne({ mobile: data.mobile });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Mobile number is already registered." });
    }

    const registrationId = "REG-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    const ticketNumber = generateTicketNumber();

    const newRegistration = new Registration({
      ...data,
      registrationId,
      ticketNumber,
      qrCode: registrationId,
      status: "Verified",
    });

    await newRegistration.save();

    res.json({ success: true, registrationId: newRegistration.registrationId });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: error.message || "Something went wrong" });
  }
});

// Get registration details
router.get("/verify/:id", async (req, res) => {
  try {
    const registrationId = req.params.id;
    const registration = await Registration.findOne({ registrationId }).lean();
    
    if (!registration) {
      return res.status(404).json({ success: false, error: "Registration not found" });
    }
    
    res.json({ success: true, registration });
  } catch (error: any) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch details" });
  }
});

export default router;
