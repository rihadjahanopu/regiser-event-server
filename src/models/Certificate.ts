import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICertificate extends Document {
  certificateId: string;
  registrationId: string;
  fullName: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventAddress: string;
  generatedDate: Date;
  generatedByAdmin: string;
}

const CertificateSchema: Schema = new Schema(
  {
    certificateId: { type: String, required: true, unique: true },
    registrationId: { type: String, required: true },
    fullName: { type: String, required: true },
    eventId: { type: String, required: true },
    eventName: { type: String, required: true },
    eventDate: { type: String, required: true },
    eventAddress: { type: String, required: true },
    generatedDate: { type: Date, default: Date.now },
    generatedByAdmin: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

CertificateSchema.index({ registrationId: 1 });
CertificateSchema.index({ certificateId: 1 });
CertificateSchema.index({ eventId: 1 });

export const Certificate =
  (mongoose.models.Certificate as Model<ICertificate>) ||
  mongoose.model<ICertificate>("Certificate", CertificateSchema);
