import mongoose from "mongoose";
import Settings from "./src/models/Settings.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to MongoDB");

    let settings = await Settings.findOne({});
    console.log("Existing settings:", settings);

    if (!settings) {
      settings = new Settings({ isRegistrationOpen: false });
    } else {
      settings.isRegistrationOpen = !settings.isRegistrationOpen;
    }

    await settings.save();
    console.log("Settings saved:", settings);
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    mongoose.disconnect();
  }
}

run();
