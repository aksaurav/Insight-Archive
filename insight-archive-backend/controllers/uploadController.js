import pdf from "pdf-parse-fork";
import Document from "../models/Document.js";
import { embedAndStore, deleteNamespace } from "../utils/aiHelper.js";

/**
 * Handles PDF upload, text extraction, MongoDB metadata storage,
 * and Pinecone vector indexing.
 */
export const uploadDocument = async (req, res) => {
  let createdDocId = null;

  try {
    // 1. Basic Validation
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are supported" });
    }

    // 2. Extract Text from PDF Buffer
    // With pdf-parse-fork, it's a direct, standard ESM import.
    const data = await pdf(req.file.buffer);
    console.log("PDF Data Object:", data);
    console.log(
      "Raw Extracted Text Length:",
      data.text ? data.text.length : "NULL",
    );
    const extractedText = data.text;

    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({
        message: "PDF seems to be empty or image-based (OCR required).",
      });
    }

    // 3. Generate Unique Namespace for Vector Isolation
    const namespace = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;

    // 4. Save Metadata to MongoDB
    // Using a placeholder User ID until Auth Middleware is implemented
    const newDoc = await Document.create({
      user: "65f1a2b3c4d5e6f7a8b9c0d1", // Dummy ID for now
      fileName: req.file.originalname,
      pineconeNamespace: namespace,
    });

    createdDocId = newDoc._id;

    // 5. Trigger RAG Pipeline: Chunking + Embedding + Pinecone Upload
    console.log(`Starting AI indexing for: ${req.file.originalname}`);

    // Pass extracted text and the namespace to our helper
    await embedAndStore(extractedText, namespace);

    // 6. Final Response
    res.status(201).json({
      message: "File processed and AI-indexed successfully!",
      document: newDoc,
      preview: extractedText.substring(0, 150).replace(/\n/g, " ") + "...",
    });
  } catch (error) {
    console.error("Critical Upload Error:", error);

    // ROLLBACK: If MongoDB saved but Pinecone/Embedding failed, delete the record
    if (createdDocId) {
      try {
        await Document.findByIdAndDelete(createdDocId);
        console.log(
          "Rollback: Deleted MongoDB record due to AI indexing failure.",
        );
      } catch (dbError) {
        console.error("Rollback failed:", dbError);
      }
    }

    res.status(500).json({
      message: "Processing failed.",
      error: error.message,
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Try deleting from Pinecone first
    await deleteNamespace(document.pineconeNamespace);

    // Then delete from Mongo
    await Document.findByIdAndDelete(id);

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    // This log in your terminal is the key to fixing this!
    console.error("DETAILED ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (error) {
    console.error("Fetch Docs Error:", error);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};
