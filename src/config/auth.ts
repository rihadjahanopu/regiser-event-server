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
  /**
   * baseURL: The URL where better-auth is accessible FROM THE CLIENT'S PERSPECTIVE.
   * Since we use a Next.js proxy at /api/auth, the client sees auth on the frontend domain.
   * In production: https://talamijbd.vercel.app
   * In development: http://localhost:3000
   */
  baseURL: process.env.CLIENT_URL || "http://localhost:3000",
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://talamijbd.vercel.app",
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
