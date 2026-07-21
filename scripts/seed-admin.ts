import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Admin } from "../src/models/Admin";

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/talamij");
    console.log("Connected to MongoDB");

    const email = "admin@example.com";
    const existing = await Admin.findOne({ email });

    if (existing) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash("password123", 10);
    
    await Admin.create({
      name: "Super Admin",
      email,
      password: passwordHash,
      role: "admin",
    });

    console.log("Admin user created! (admin@example.com / password123)");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }
}

seed();
