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

    console.log(`Processing file: ${req.file.originalname}`);

    // 2. Extract Text from PDF Buffer
    // FIX: Some environments require accessing .default when using ESM with this library
    const pdfParser = pdf.default || pdf;

    let data;
    try {
      data = await pdfParser(req.file.buffer);
    } catch (parseError) {
      console.error("PDF Parsing Error:", parseError);
      return res.status(422).json({ message: "Could not read PDF content." });
    }

    const extractedText = data?.text;

    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({
        message: "PDF seems to be empty or image-based (OCR required).",
      });
    }

    // 3. Generate Unique Namespace for Vector Isolation
    // Clean filename to prevent Pinecone metadata issues
    const safeName = req.file.originalname
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const namespace = `${Date.now()}-${safeName}`;

    // 4. Save Metadata to MongoDB
    // Placeholder User ID remains until Auth is added
    const newDoc = await Document.create({
      user: "65f1a2b3c4d5e6f7a8b9c0d1",
      fileName: req.file.originalname,
      pineconeNamespace: namespace,
    });

    createdDocId = newDoc._id;

    // 5. Trigger RAG Pipeline: Chunking + Embedding + Pinecone Upload
    console.log(`Starting Gemini indexing for namespace: ${namespace}`);

    // Pass extracted text and the namespace to our helper
    await embedAndStore(extractedText, namespace);

    // 6. Final Response
    res.status(201).json({
      message: "File processed and AI-indexed successfully!",
      document: newDoc,
      preview: extractedText.substring(0, 150).replace(/\n/g, " ") + "...",
    });
  } catch (error) {
    // The "Detailed Error" log is your best friend on Render
    console.error("CRITICAL UPLOAD ERROR:", error);

    // ROLLBACK: If MongoDB saved but AI indexing failed, delete the record
    if (createdDocId) {
      try {
        await Document.findByIdAndDelete(createdDocId);
        console.log("Rollback: Deleted MongoDB record due to AI failure.");
      } catch (dbError) {
        console.error("Rollback failed:", dbError);
      }
    }

    res.status(500).json({
      message: "Server processing failed.",
      error: error.message, // This helps you see the actual crash reason in the network tab
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
      return res.status(404).json({ message: "Document not found" });
    }

    console.log(
      `Deleting document and namespace: ${document.pineconeNamespace}`,
    );

    // Delete from Pinecone
    await deleteNamespace(document.pineconeNamespace);

    // Delete from Mongo
    await Document.findByIdAndDelete(id);

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("DETAILED DELETE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Fetches all documents for the user.
 */
export const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (error) {
    console.error("Fetch Docs Error:", error);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};
