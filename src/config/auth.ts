import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import dotenv from "dotenv";

dotenv.config();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "super-secret-key-for-dev",
  plugins: [jwt()],
  baseURL: process.env.API_URL || "http://localhost:5000",
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
  },
});
