import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvent extends Document {
  title: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  bannerPublicId?: string;
  eventDate?: string;
  eventStartTime?: string;
  venue?: string;
  showCountdown?: boolean;
  isRegistrationOpen: boolean;
  isFeatured: boolean;
  status: "Upcoming" | "Ongoing" | "Completed" | "Draft";
  fieldConfig?: {
    email?: boolean;
    dob?: boolean;
    fatherName?: boolean;
    motherName?: boolean;
    rollNumber?: boolean;
    regNumber?: boolean;
    bloodGroup?: boolean;
    emergencyContact?: boolean;
    passingYear?: boolean;
    gradeGpa?: boolean;
    gender?: boolean;
    address?: boolean;
    district?: boolean;
    schoolName?: boolean;
    class?: boolean;
    subjectGroup?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    bannerPublicId: { type: String, default: "" },
    eventDate: { type: String, default: "" },
    eventStartTime: { type: String, default: "" },
    venue: { type: String, default: "" },
    showCountdown: { type: Boolean, default: true },
    isRegistrationOpen: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed", "Draft"],
      default: "Upcoming",
    },
    fieldConfig: {
      type: Schema.Types.Mixed,
      default: {
        email: true,
        dob: false,
        fatherName: true,
        motherName: false,
        rollNumber: false,
        regNumber: false,
        bloodGroup: false,
        emergencyContact: true,
        passingYear: false,
        gradeGpa: false,
        gender: true,
        address: true,
        district: true,
        schoolName: true,
        class: true,
        subjectGroup: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Event =
  (mongoose.models.Event as Model<IEvent>) ||
  mongoose.model<IEvent>("Event", EventSchema);
