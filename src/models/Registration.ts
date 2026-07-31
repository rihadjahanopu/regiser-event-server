import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRegistration extends Document {
  registrationId: string;
  ticketNumber: string;
  eventId?: mongoose.Types.ObjectId | string;
  eventSlug?: string;
  fullName: string;
  mobile: string;
  email?: string;
  gender?: string;
  address?: string;
  district?: string;
  schoolName?: string;
  class?: string;
  subjectGroup?: string;
  fatherName?: string;
  motherName?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  dob?: string;
  passingYear?: string;
  gradeGpa?: string;
  rollNumber?: string;
  regNumber?: string;
  registrationDate: Date;
  qrCode: string;
  status: "Verified" | "Pending" | "Invalid";
  attendance: "Present" | "Absent";
  attendedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema: Schema = new Schema(
  {
    registrationId: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true, unique: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", index: true, default: null },
    eventSlug: { type: String, index: true, default: "" },
    fullName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String },
    gender: { type: String },
    address: { type: String },
    district: { type: String },
    schoolName: { type: String },
    class: { type: String },
    subjectGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    bloodGroup: { type: String },
    emergencyContact: { type: String },
    dob: { type: String },
    passingYear: { type: String },
    gradeGpa: { type: String },
    rollNumber: { type: String },
    regNumber: { type: String },
    registrationDate: { type: Date, default: Date.now },
    qrCode: { type: String, required: true },
    status: {
      type: String,
      enum: ["Verified", "Pending", "Invalid"],
      default: "Verified",
    },
    attendance: {
      type: String,
      enum: ["Present", "Absent"],
      default: "Absent",
    },
    attendedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const Registration =
  (mongoose.models.Registration as Model<IRegistration>) ||
  mongoose.model<IRegistration>("Registration", RegistrationSchema);
