import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRegistration extends Document {
  registrationId: string;
  ticketNumber: string;
  fullName: string;
  mobile: string;
  email?: string;
  gender: string;
  address: string;
  district: string;
  schoolName: string;
  class: string;
  subjectGroup: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema: Schema = new Schema(
  {
    registrationId: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String },
    gender: { type: String, required: true },
    address: { type: String, required: true },
    district: { type: String, required: true },
    schoolName: { type: String, required: true },
    class: { type: String, required: true },
    subjectGroup: { type: String, required: true },
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
  },
  {
    timestamps: true,
  }
);

export const Registration =
  (mongoose.models.Registration as Model<IRegistration>) ||
  mongoose.model<IRegistration>("Registration", RegistrationSchema);
