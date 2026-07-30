import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import registrationRoutes from "./routes/registration.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";
import blogRoutes from "./routes/blog.js";
import userRoutes from "./routes/user.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "https://talamijbd.vercel.app",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Vercel serverless, curl, etc.), matching allowedOrigins, or any *.vercel.app preview domain
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} not allowed`));
    }
  },
  credentials: true,
}));

import { connectDB } from "./config/db.js";

// Ensure database connection is established before processing API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err: any) {
    console.error("Database connection middleware failure:", err);
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ success: false, error: "Database connection failed. Please try again." });
    }
    next();
  }
});

// Basic route
app.get("/", (req, res) => {
  res.send("API is running");
});

// Better Auth
app.use("/api/auth", toNodeHandler(auth));

// API Routes
app.use("/api/registration", registrationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/user", userRoutes);

// Start server locally (Vercel will use the exported app instead)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
