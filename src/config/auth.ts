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
  baseURL: process.env.API_URL || "http://localhost:5000",
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "https://talamijbd.vercel.app",
  ],
  database: mongodbAdapter(db),
  emailAndPassword: {
    enabled: true,
  },
});
