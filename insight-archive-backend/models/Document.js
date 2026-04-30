import mongoose, { mongo } from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
    },
    pineconeNamespace: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Document", documentSchema);
