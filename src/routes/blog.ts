import { Router } from "express";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import Blog from "../models/Blog.js";
import { cloudinary, upload } from "../config/cloudinary.js";

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

// 1. GET /published — Public route to fetch all published blogs
router.get("/published", async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    let query: any = { status: "Published" };

    if (category) {
      query.category = category;
    }
    if (tag) {
      query.tags = tag;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
      ];
    }

    const blogs = await Blog.find(query)
      .populate("author", "name email image username")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: blogs });
  } catch (error) {
    console.error("Error fetching published blogs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch published blogs" });
  }
});

// 2. GET /my-blogs — Get current user's blogs
router.get("/my-blogs", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const blogs = await Blog.find({ author: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: blogs });
  } catch (error) {
    console.error("Error fetching user's blogs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user's blogs" });
  }
});

// GET /by-id/:id — Fetch blog details by ID for editing/reviewing
router.get("/by-id/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id).populate("author", "name email image username");
    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }
    // Only author or admin can retrieve unpublished blog details by ID
    const isAuthor = blog.author._id.toString() === (req as any).session.user.id;
    const isAdmin = (req as any).session.user.role === "admin";
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: "Unauthorized access to this blog" });
    }
    res.json({ success: true, data: blog });
  } catch (error) {
    console.error("Error fetching blog by ID:", error);
    res.status(500).json({ success: false, error: "Failed to fetch blog by ID" });
  }
});

// 3. GET /:slug — Public route for single blog details (with view increment)
router.get("/detail/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug }).populate("author", "name email image username");

    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    // Protection rule: The blog is only visible to the author and admins until it is approved (Published)
    if (blog.status !== "Published") {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const isAuthor = session && session.user.id === blog.author._id.toString();
      const isAdmin = session && session.user.role === "admin";

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, error: "Unauthorized access to this blog post" });
      }
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error("Error fetching blog details:", error);
    res.status(500).json({ success: false, error: "Failed to fetch blog details" });
  }
});

// 4. POST / — Create a new blog post
router.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "featuredImage", maxCount: 1 },
  ]),
  async (req: any, res) => {
    try {
      const {
        title,
        category,
        tags,
        shortDescription,
        content,
        seoTitle,
        seoDescription,
        isDraft,
      } = req.body;

      if (!title || !category || !shortDescription || !content) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Generate slug from title + random string to ensure uniqueness
      const slugBase = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const slug = `${slugBase}-${uniqueSuffix}`;

      // Upload images if present
      let coverImageUrl = "";
      let featuredImageUrl = "";

      if (req.files) {
        if (req.files.coverImage && req.files.coverImage[0]) {
          const coverRes = await uploadToCloudinary(req.files.coverImage[0].buffer, "talamij/blogs");
          coverImageUrl = coverRes.secure_url;
        }
        if (req.files.featuredImage && req.files.featuredImage[0]) {
          const featRes = await uploadToCloudinary(req.files.featuredImage[0].buffer, "talamij/blogs");
          featuredImageUrl = featRes.secure_url;
        }
      }

      // Handle raw URLs if sent as text fallback (e.g. from frontend state)
      if (!coverImageUrl && req.body.coverImageUrl) {
        coverImageUrl = req.body.coverImageUrl;
      }
      if (!featuredImageUrl && req.body.featuredImageUrl) {
        featuredImageUrl = req.body.featuredImageUrl;
      }

      // Parse tags
      let tagArray: string[] = [];
      if (tags) {
        tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
      }

      // Calculate estimated reading time
      const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
      const estimatedReadingTime = Math.ceil(words / 200) || 1;

      // Status logic: Save as Draft or Submit for Review
      const status = isDraft === "true" || isDraft === true ? "Draft" : "Reviewing";

      const newBlog = await Blog.create({
        title,
        slug,
        category,
        tags: tagArray,
        shortDescription,
        content,
        coverImage: coverImageUrl,
        featuredImage: featuredImageUrl,
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || shortDescription,
        estimatedReadingTime,
        status,
        author: (req as any).session.user.id,
      });

      res.status(201).json({ success: true, data: newBlog });
    } catch (error: any) {
      console.error("Error creating blog:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to create blog" });
    }
  }
);

// 5. PUT /:id — Update blog (Draft or Rejected only)
router.put(
  "/:id",
  requireAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "featuredImage", maxCount: 1 },
  ]),
  async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        category,
        tags,
        shortDescription,
        content,
        seoTitle,
        seoDescription,
        isDraft,
      } = req.body;

      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({ success: false, error: "Blog not found" });
      }

      // Must be author
      if (blog.author.toString() !== (req as any).session.user.id) {
        return res.status(403).json({ success: false, error: "You are not the author of this blog" });
      }

      // Restriction: Only Edit Draft or Rejected
      if (blog.status !== "Draft" && blog.status !== "Rejected") {
        return res.status(400).json({ success: false, error: "Only Draft or Rejected blogs can be edited" });
      }

      const updates: any = {};
      if (title) {
        updates.title = title;
        // Optionally update slug if requested (or keep original slug for SEO stability)
      }
      if (category) updates.category = category;
      if (shortDescription) updates.shortDescription = shortDescription;
      if (content) {
        updates.content = content;
        const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
        updates.estimatedReadingTime = Math.ceil(words / 200) || 1;
      }
      if (seoTitle) updates.seoTitle = seoTitle;
      if (seoDescription) updates.seoDescription = seoDescription;

      if (tags) {
        updates.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
      }

      if (req.files) {
        if (req.files.coverImage && req.files.coverImage[0]) {
          const coverRes = await uploadToCloudinary(req.files.coverImage[0].buffer, "talamij/blogs");
          updates.coverImage = coverRes.secure_url;
        }
        if (req.files.featuredImage && req.files.featuredImage[0]) {
          const featRes = await uploadToCloudinary(req.files.featuredImage[0].buffer, "talamij/blogs");
          updates.featuredImage = featRes.secure_url;
        }
      }

      // Handle raw URLs if sent as text fallback (e.g. from frontend state)
      if (!updates.coverImage && req.body.coverImageUrl) {
        updates.coverImage = req.body.coverImageUrl;
      }
      if (!updates.featuredImage && req.body.featuredImageUrl) {
        updates.featuredImage = req.body.featuredImageUrl;
      }

      // Status transition logic
      if (isDraft !== undefined) {
        updates.status = isDraft === "true" || isDraft === true ? "Draft" : "Reviewing";
      }

      const updatedBlog = await Blog.findByIdAndUpdate(id, updates, { new: true });
      res.json({ success: true, data: updatedBlog });
    } catch (error: any) {
      console.error("Error updating blog:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to update blog" });
    }
  }
);

// 6. DELETE /:id — Delete blog (Draft only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    // Must be author
    if (blog.author.toString() !== (req as any).session.user.id) {
      return res.status(403).json({ success: false, error: "You are not the author of this blog" });
    }

    // Restriction: Only Delete Draft
    if (blog.status !== "Draft") {
      return res.status(400).json({ success: false, error: "Only Draft blogs can be deleted" });
    }

    await Blog.findByIdAndDelete(id);
    res.json({ success: true, message: "Blog deleted successfully" });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({ success: false, error: "Failed to delete blog" });
  }
});

// 7. POST /:id/duplicate — Duplicate an existing blog post (Creates as Draft)
router.post("/:id/duplicate", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    // Must be author
    if (blog.author.toString() !== (req as any).session.user.id) {
      return res.status(403).json({ success: false, error: "You are not the author of this blog" });
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const duplicatedBlog = await Blog.create({
      title: `Copy of ${blog.title}`,
      slug: `${blog.slug}-copy-${uniqueSuffix}`,
      category: blog.category,
      tags: blog.tags,
      shortDescription: blog.shortDescription,
      content: blog.content,
      coverImage: blog.coverImage,
      featuredImage: blog.featuredImage,
      seoTitle: `Copy of ${blog.seoTitle || blog.title}`,
      seoDescription: blog.seoDescription,
      estimatedReadingTime: blog.estimatedReadingTime,
      status: "Draft", // Always duplicate as draft
      author: (req as any).session.user.id,
    });

    res.status(201).json({ success: true, data: duplicatedBlog });
  } catch (error: any) {
    console.error("Error duplicating blog:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to duplicate blog" });
  }
});

// 8. POST /:id/like — Toggle like on a blog post
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).session.user.id;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    const likeIndex = blog.likes.indexOf(userId);
    if (likeIndex > -1) {
      // Unlike
      blog.likes.splice(likeIndex, 1);
    } else {
      // Like
      blog.likes.push(userId);
    }

    await blog.save();
    res.json({ success: true, likes: blog.likes, likesCount: blog.likes.length });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ success: false, error: "Failed to toggle like" });
  }
});

// 9. POST /:id/comment — Comment on a blog post
router.post("/:id/comment", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = (req as any).session.user;

    if (!content || content.trim() === "") {
      return res.status(400).json({ success: false, error: "Comment content cannot be empty" });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: "Blog not found" });
    }

    const newComment = {
      userId: user.id,
      userName: user.name,
      userImage: user.image || "",
      content: content.trim(),
      createdAt: new Date()
    };

    blog.comments.push(newComment);
    await blog.save();

    res.status(201).json({ success: true, data: newComment, comments: blog.comments });
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({ success: false, error: "Failed to post comment" });
  }
});

export default router;
