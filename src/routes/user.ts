import { Router } from "express";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { cloudinary, upload } from "../config/cloudinary.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Blog from "../models/Blog.js";
import { getDb } from "../config/db.js";

const router = Router();

// Middleware to require authentication
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    req.session = session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ success: false, error: "Authentication check failed" });
  }
};

// Stream buffer helper to upload to Cloudinary
const uploadToCloudinary = (fileBuffer: Buffer, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// 1. GET /me — Fetch profile details
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.json({ success: true, user: (req as any).session.user });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch user details" });
  }
});

// 2. PUT /profile — Update personal info with avatar picture upload
router.put("/profile", requireAuth, upload.single("image"), async (req: any, res) => {
  try {
    const userId = req.session.user.id;
    const { name, username, bio, phoneNumber, website, location } = req.body;

    const updates: any = {};
    if (name) updates.name = name;
    if (username) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (website !== undefined) updates.website = website;
    if (location !== undefined) updates.location = location;

    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer, "talamij/users");
      updates.image = uploadRes.secure_url;
    }

    // Direct update in better-auth's user collection in MongoDB
    const db = await getDb();

    let queryId: any = userId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      queryId = new mongoose.Types.ObjectId(userId);
    }
    const userFilter = { $or: [{ _id: userId }, { _id: queryId }, { id: userId }] };

    // Check unique username if username is provided
    if (username) {
      const existingUser = await db.collection("user").findOne({
        username,
        $and: [
          { _id: { $ne: userId } },
          { _id: { $ne: queryId } },
          { id: { $ne: userId } }
        ]
      });
      if (existingUser) {
        return res.status(400).json({ success: false, error: "Username already taken" });
      }
    }

    await db.collection("user").updateOne(
      userFilter,
      { $set: updates }
    );

    const updatedUser = await db.collection("user").findOne(userFilter);

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update profile" });
  }
});

// 3. PUT /settings — Update account notification and privacy settings
router.put("/settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const { emailNotifications, pushNotifications, privacySettings, twoFactorEnabled } = req.body;

    const updates: any = {};
    if (emailNotifications !== undefined) updates.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) updates.pushNotifications = pushNotifications;
    if (privacySettings !== undefined) updates.privacySettings = privacySettings;
    if (twoFactorEnabled !== undefined) updates.twoFactorEnabled = twoFactorEnabled;

    const db = await getDb();

    await db.collection("user").updateOne(
      { _id: new mongoose.Types.ObjectId(userId) as any },
      { $set: updates }
    );

    const updatedUser = await db.collection("user").findOne({ _id: new mongoose.Types.ObjectId(userId) as any });
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update settings" });
  }
});

// 4. GET /sessions — Get active sessions list
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const db = await getDb();

    const sessions = await db.collection("session")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Map sessions to include readable browser info and identify current session
    const currentToken = (req as any).session.session.token;
    const sessionList = sessions.map((s: any) => ({
      id: s._id || s.id,
      userAgent: s.userAgent || "Unknown Device",
      ipAddress: s.ipAddress || "Unknown IP",
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      isCurrent: s.token === currentToken
    }));

    res.json({ success: true, data: sessionList });
  } catch (error: any) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch sessions" });
  }
});

// 5. POST /sessions/revoke — Revoke (delete) a specific session
router.post("/sessions/revoke", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Session ID is required" });
    }

    const db = await getDb();

    // Convert sessionId string to ObjectId if necessary
    let queryId: any = sessionId;
    try {
      queryId = new mongoose.Types.ObjectId(sessionId);
    } catch {
      // Keep as string
    }

    await db.collection("session").deleteOne({
      $and: [
        { $or: [{ _id: queryId }, { id: sessionId }] },
        { userId }
      ]
    });

    res.json({ success: true, message: "Session revoked successfully" });
  } catch (error: any) {
    console.error("Error revoking session:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to revoke session" });
  }
});

// 6. POST /sessions/revoke-all — Logout from all other devices
router.post("/sessions/revoke-all", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const currentToken = (req as any).session.session.token;

    const db = await getDb();

    // Delete all sessions except the current active one
    await db.collection("session").deleteMany({
      userId,
      token: { $ne: currentToken }
    });

    res.json({ success: true, message: "Logged out from all other devices successfully" });
  } catch (error: any) {
    console.error("Error revoking all other sessions:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to logout from other devices" });
  }
});

// 7. DELETE /account — Delete user account
router.delete("/account", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: "Password confirmation is required to delete account" });
    }

    const db = await getDb();

    // Retrieve full user record to verify password
    const user = await db.collection("user").findOne({ _id: new mongoose.Types.ObjectId(userId) as any });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Find account to get password hash if stored there (better-auth defaults password to user model or account model depending on provider)
    const account = await db.collection("account").findOne({ userId });
    const passwordHash = user.password || (account ? account.password : null);

    if (!passwordHash) {
      return res.status(400).json({ success: false, error: "No password found on account. Cannot verify." });
    }

    const match = await bcrypt.compare(password, passwordHash);
    if (!match) {
      return res.status(400).json({ success: false, error: "Incorrect password. Account deletion aborted." });
    }

    // Delete User data: user, sessions, accounts, and optional blogs cleanup (or set author to null or keep them but flag author as deleted)
    // Clean up sessions and accounts
    await db.collection("session").deleteMany({ userId });
    await db.collection("account").deleteMany({ userId });
    await db.collection("user").deleteOne({ _id: new mongoose.Types.ObjectId(userId) as any });

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting account:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete account" });
  }
});

// 8. GET /notifications — Get dynamic notifications for user
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const notifications: any[] = [];

    // System Welcome Notification
    notifications.push({
      id: "sys-welcome",
      type: "system",
      title: "Welcome to Talamij Portal",
      message: "Manage your blog articles, account preferences, and view reader engagement statistics.",
      createdAt: (req as any).session.user.createdAt || new Date(),
      read: true,
      link: "/dashboard"
    });

    // Fetch user's blogs
    const blogs = await Blog.find({ author: userId }).sort({ updatedAt: -1 });

    for (const blog of blogs) {
      if (blog.status === "Published") {
        notifications.push({
          id: `blog-pub-${blog._id}`,
          type: "blog_published",
          title: "Blog Published!",
          message: `Your blog article "${blog.title}" has been reviewed, approved, and published live.`,
          createdAt: blog.updatedAt,
          read: false,
          link: `/blog/${blog.slug}`
        });
      } else if (blog.status === "Rejected") {
        notifications.push({
          id: `blog-rej-${blog._id}`,
          type: "blog_rejected",
          title: "Blog Needs Revision",
          message: `Your blog article "${blog.title}" was not approved. ${blog.rejectionReason ? `Reason: ${blog.rejectionReason}` : "Please check submission guidelines."}`,
          createdAt: blog.updatedAt,
          read: false,
          link: `/dashboard/edit-blog/${blog._id}`
        });
      } else if (blog.status === "Reviewing") {
        notifications.push({
          id: `blog-rev-${blog._id}`,
          type: "blog_review",
          title: "Blog Under Review",
          message: `Your blog article "${blog.title}" has been submitted and is currently being reviewed by admins.`,
          createdAt: blog.updatedAt,
          read: true,
          link: `/dashboard/my-blogs`
        });
      }

      // Comments on user's blog
      if (blog.comments && blog.comments.length > 0) {
        for (const comment of blog.comments) {
          if (comment.userId !== userId) {
            notifications.push({
              id: `comment-${comment._id || comment.createdAt}`,
              type: "comment",
              title: "New Comment on Your Blog",
              message: `${comment.userName || "A user"} commented: "${comment.content.substring(0, 60)}${comment.content.length > 60 ? "..." : ""}" on "${blog.title}"`,
              createdAt: comment.createdAt,
              read: false,
              link: `/blog/${blog.slug}`
            });
          }
        }
      }
    }

    // Sort notifications by date descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: notifications });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

export default router;
