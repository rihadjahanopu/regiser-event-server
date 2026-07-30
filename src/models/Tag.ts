import mongoose, { Schema, Document } from "mongoose";

export interface ITag extends Document {
  name: string;
  slug: string;
}

const TagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

const Tag = mongoose.models.Tag || mongoose.model<ITag>("Tag", TagSchema);
export default Tag;
