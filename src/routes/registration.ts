import { Router } from "express";
import { Registration } from "../models/Registration.js";
import { Certificate } from "../models/Certificate.js";
import { Event } from "../models/Event.js";

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
    
    const existingQuery: any = { mobile: data.mobile };
    if (data.eventId) existingQuery.eventId = data.eventId;
    else if (data.eventSlug) existingQuery.eventSlug = data.eventSlug;

    const existingUser = await Registration.findOne(existingQuery);
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Mobile number is already registered for this event." });
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
    
    let event = null;
    if (registration.eventId) {
      event = await Event.findById(registration.eventId).lean();
    } else if (registration.eventSlug) {
      event = await Event.findOne({ slug: registration.eventSlug }).lean();
    }
    
    res.json({ success: true, registration, event });
  } catch (error: any) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch details" });
  }
});

// Get certificate verification details (Public QR code scanner endpoint)
router.get("/verify/certificate/:certificateId", async (req, res) => {
  try {
    const { certificateId } = req.params;
    const certificate = await Certificate.findOne({ certificateId }).lean();

    if (!certificate) {
      return res.status(404).json({ success: false, error: "Certificate not found or invalid" });
    }

    const registration = await Registration.findOne({ registrationId: certificate.registrationId }).lean();

    res.json({
      success: true,
      certificate,
      registration: registration || null,
    });
  } catch (error: any) {
    console.error("Certificate verification error:", error);
    res.status(500).json({ success: false, error: "Failed to verify certificate" });
  }
});

export default router;
