import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // This checks for the exact key in your screenshot (MONGO_URI)
    // or the common one (MONGODB_URI)
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
      console.error(
        "❌ DATABASE ERROR: No URI found in Environment Variables.",
      );
      return;
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
