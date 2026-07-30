import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let dbPromise: Promise<typeof mongoose> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState >= 1 && mongoose.connection.db) {
    return mongoose.connection.db;
  }

  if (!dbPromise) {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/talamij";

    dbPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    await dbPromise;
  } catch (err) {
    dbPromise = null;
    throw err;
  }

  const db = mongoose.connection.db || (mongoose.connection.getClient() as any)?.db();
  if (!db) {
    throw new Error("MongoDB database instance not initialized");
  }
  return db;
}

export async function getDb() {
  return await connectDB();
}
