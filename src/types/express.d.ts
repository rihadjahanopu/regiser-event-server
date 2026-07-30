// src/types/express.d.ts
// Augments Express Request to include `session` injected by auth middleware
import "express";

declare global {
  namespace Express {
    interface Request {
      session?: {
        user: {
          id: string;
          name: string;
          email: string;
          role?: string;
          image?: string;
        };
        session: {
          id: string;
          userId: string;
          expiresAt: Date;
        };
      };
    }
  }
}
