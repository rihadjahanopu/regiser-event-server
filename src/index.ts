import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import registrationRoutes from "./routes/registration";
import adminRoutes from "./routes/admin";
import settingsRoutes from "./routes/settings";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true, // Allow cookies for better-auth if needed
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/talamij")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

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

// Start server locally (Vercel will use the exported app instead)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
