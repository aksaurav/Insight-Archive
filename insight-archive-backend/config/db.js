import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Ensure the variable name matches your Render Environment Variables exactly
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
      throw new Error(
        "MongoDB connection string is missing in environment variables.",
      );
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast (5s) instead of waiting 30s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // This will force Render to restart the service if the DB is down
    process.exit(1);
  }
};

export default connectDB;
