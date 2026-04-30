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
    // ==========================
    // 1. VALIDATION
    // ==========================
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "Only PDF files are supported",
      });
    }

    console.log(`📄 Processing file: ${req.file.originalname}`);

    // ==========================
    // 2. PDF PARSING
    // ==========================
    const pdfParser = pdf?.default || pdf;

    let data;
    try {
      data = await pdfParser(req.file.buffer);
    } catch (parseError) {
      console.error("❌ PDF Parsing Error:", parseError);
      return res.status(422).json({
        message: "Could not read PDF content.",
      });
    }

    const extractedText = data?.text;

    // ==========================
    // 3. TEXT VALIDATION
    // ==========================
    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({
        message:
          "PDF appears empty or image-based. OCR is required for scanned files.",
      });
    }

    console.log(`📝 Extracted text length: ${extractedText.length} characters`);

    // ==========================
    // 4. NAMESPACE GENERATION
    // ==========================
    const safeName = req.file.originalname
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .slice(0, 50); // prevent overly long namespace

    const namespace = `${Date.now()}-${safeName}`;

    // ==========================
    // 5. SAVE METADATA (MongoDB)
    // ==========================
    const newDoc = await Document.create({
      user: "65f1a2b3c4d5e6f7a8b9c0d1", // TODO: replace with auth later
      fileName: req.file.originalname,
      pineconeNamespace: namespace,
    });

    createdDocId = newDoc._id;

    console.log(`🗂 MongoDB record created: ${createdDocId}`);
    console.log(`🚀 Starting AI indexing (namespace: ${namespace})`);

    // ==========================
    // 6. AI PIPELINE (CRITICAL)
    // ==========================
    await embedAndStore(extractedText, namespace);

    console.log("✅ AI indexing completed");

    // ==========================
    // 7. RESPONSE
    // ==========================
    res.status(201).json({
      message: "File processed and AI-indexed successfully!",
      document: newDoc,
      preview: extractedText.substring(0, 150).replace(/\n/g, " ") + "...",
    });
  } catch (error) {
    console.error("🔥 CRITICAL UPLOAD ERROR:", error);

    // ==========================
    // ROLLBACK
    // ==========================
    if (createdDocId) {
      try {
        await Document.findByIdAndDelete(createdDocId);
        console.log("↩️ Rollback: MongoDB record deleted");
      } catch (dbError) {
        console.error("❌ Rollback failed:", dbError);
      }
    }

    res.status(500).json({
      message: "Server processing failed.",
      error: error.message,
    });
  }
};

/**
 * Deletes a document from both MongoDB and Pinecone.
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    console.log(`🗑 Deleting namespace: ${document.pineconeNamespace}`);

    await deleteNamespace(document.pineconeNamespace);
    await Document.findByIdAndDelete(id);

    res.status(200).json({
      message: "Deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};

/**
 * Fetches all documents
 */
export const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({
      createdAt: -1,
    });

    res.status(200).json(documents);
  } catch (error) {
    console.error("❌ FETCH DOCS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch documents",
    });
  }
};
