import { queryDocument } from "../utils/aiHelper.js";
import Document from "../models/Document.js";
import Message from "../models/Message.js";

export const chatWithDocument = async (req, res) => {
  try {
    const { question, docId } = req.body;

    if (!question || !docId) {
      return res
        .status(400)
        .json({ message: `Question and Document ID are required` });
    }

    // 1. Fetch the document from MongoDB to get the specific namespace
    const document = await Document.findById(docId);

    if (!document) {
      return res
        .status(404)
        .json({ message: `Document not found in database` });
    }

    // 2. Query the AI (Similarity Search + LLM Generation)
    console.log(`Querying AI for Doc: ${document.fileName}`);

    const answer = await queryDocument(question, document.pineconeNamespace);

    res.status(200).json({ answer, source: document.fileName });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    res.status(500).json({
      message: "The AI encountered an error processing your question.",
    });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { docId } = req.params;
    const history = await Message.find({ documentId: docId }).sort({
      createdAt: 1,
    });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: `Error fetching history` });
  }
};

export const askQuestion = async (req, res) => {
  try {
    const { question, docId } = req.body;

    // Save User Question
    await Message.create({
      documentId: docId,
      role: "user",
      content: question,
    });

    // Get AI Answer
    const answer = await queryDocument(question, docId);

    // Save AI Answer
    await Message.create({ documentId: docId, role: "ai", content: answer });

    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
