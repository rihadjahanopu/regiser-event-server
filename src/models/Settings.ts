import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    eventCoverUrl: {
      type: String,
      default: null,
    },
    eventCoverPublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export default Settings;
