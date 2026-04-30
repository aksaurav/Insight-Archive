import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Force the use of MONGO_URI to match your manual check
    const uri = process.env.MONGO_URI;

    if (!uri) {
      console.error("❌ MONGO_URI is undefined in Render environment!");
      return;
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
