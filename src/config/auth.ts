import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/talamij"
);

await client.connect();

const db = client.db();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "super-secret-key-for-dev",
  plugins: [jwt()],
  // baseURL is the URL of this API server (where /api/auth/* is mounted)
  baseURL: process.env.API_URL || "http://localhost:5000",
  trustedOrigins: [
    // Next.js app (both local and production)
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // Production Vercel
    "https://talamijbd.vercel.app",
    // Any Vercel preview URL
    "https://*.vercel.app",
  ],
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
      username: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      website: {
        type: "string",
        required: false,
      },
      location: {
        type: "string",
        required: false,
      },
      twoFactorEnabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      emailNotifications: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      pushNotifications: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      privacySettings: {
        type: "string",
        required: false,
        defaultValue: "public",
      },
    },
  },
});
