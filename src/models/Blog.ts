import mongoose, { Schema, Document } from "mongoose";

// Minimal schema registration to allow Mongoose populate with better-auth's user collection
const UserSchema = new Schema({}, { strict: false });
export const User = mongoose.models.User || mongoose.model("User", UserSchema, "user");

export interface IComment {
  userId: string;
  userName: string;
  userImage?: string;
  content: string;
  createdAt: Date;
}

export interface IBlog extends Document {
  title: string;
  slug: string;
  category: string;
  tags: string[];
  shortDescription: string;
  content: string;
  coverImage?: string;
  featuredImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  estimatedReadingTime: number;
  status: "Draft" | "Reviewing" | "Pending" | "Published" | "Rejected";
  author: mongoose.Types.ObjectId;
  views: number;
  likes: string[]; // array of userIds
  comments: IComment[];
  reach: number;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userImage: { type: String },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const BlogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    tags: [{ type: String }],
    shortDescription: { type: String, required: true },
    content: { type: String, required: true },
    coverImage: { type: String },
    featuredImage: { type: String },
    seoTitle: { type: String },
    seoDescription: { type: String },
    estimatedReadingTime: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Draft", "Reviewing", "Pending", "Published", "Rejected"],
      default: "Draft"
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    views: { type: Number, default: 0 },
    likes: [{ type: String }],
    comments: [CommentSchema],
    reach: { type: Number, default: 0 },
    rejectionReason: { type: String }
  },
  { timestamps: true }
);

const Blog = mongoose.models.Blog || mongoose.model<IBlog>("Blog", BlogSchema);
export default Blog;
