import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const settingsSchema = new mongoose.Schema(
  {
    eventCoverUrl: { type: String, default: null },
    eventCoverPublicId: { type: String, default: null },
    isRegistrationOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/talamij");
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { isRegistrationOpen: false },
      { upsert: true, new: true }
    );
    console.log(settings);
  } catch(e) {
    console.error("ERROR", e);
  }
  process.exit(0);
}
run();
