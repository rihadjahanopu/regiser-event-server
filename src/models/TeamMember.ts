import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },       // e.g. "President"
    designation: { type: String, default: "" },   // e.g. "President, Chhatak Uttar"
    imageUrl: { type: String, default: "" },
    publicId: { type: String, default: "" },
    signatureUrl: { type: String, default: "" },
    signaturePublicId: { type: String, default: "" },
    order: { type: Number, default: 0 },          // display order
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const TeamMember =
  mongoose.models.TeamMember ||
  mongoose.model("TeamMember", teamMemberSchema);

export default TeamMember;
