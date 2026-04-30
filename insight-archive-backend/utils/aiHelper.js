import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

// ==========================
// ✅ ENV VALIDATION
// ==========================
const validateEnv = () => {
  const keys = ["GOOGLE_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_NAME"];
  keys.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(
        `❌ Configuration Error: ${key} is missing in environment variables.`,
      );
    }
  });
};

// ==========================
// ✅ CONFIGURATION HELPERS
// ==========================
const getEmbeddings = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    // Try using 'models/text-embedding-004' (with the prefix)
    // and provide both common property names for compatibility
    modelName: "models/text-embedding-004",
    model: "models/text-embedding-004",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  });
};
const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pc.index(process.env.PINECONE_INDEX_NAME);
};

// ==========================
// 🚀 EMBED + STORE
// ==========================
export const embedAndStore = async (text, namespace) => {
  try {
    validateEnv();
    const index = getPineconeIndex();
    const embeddings = getEmbeddings();

    if (!text || text.trim().length === 0) {
      throw new Error("No text content found to index.");
    }

    // Dynamic dimension detection to prevent index mismatches
    const testEmbedding = await embeddings.embedQuery("health check");
    console.log(
      `🧪 Verified: Model returning ${testEmbedding.length} dimensions.`,
    );

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });

    const docs = await splitter.createDocuments([text]);

    if (!docs || docs.length === 0) {
      throw new Error("Text splitting failed.");
    }

    console.log(
      `📡 Sending ${docs.length} chunks to Pinecone (Namespace: ${namespace})`,
    );

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace,
      textKey: "text",
    });

    console.log("✅ Vector storage successful");
    return true;
  } catch (error) {
    console.error("❌ EMBED ERROR:", error.message);
    throw new Error(`Vector indexing failed: ${error.message}`);
  }
};

// ==========================
// 🔍 QUERY
// ==========================
export const queryDocument = async (question, namespace) => {
  try {
    validateEnv();
    const index = getPineconeIndex();
    const embeddings = getEmbeddings();

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace,
      textKey: "text",
    });

    const results = await vectorStore.similaritySearch(question, 4);

    if (!results || results.length === 0) {
      return "I couldn't find any relevant information in that document.";
    }

    const context = results.map((r) => r.pageContent).join("\n\n");

    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
    });

    const prompt = `You are a helpful AI assistant. Use the provided context to answer the question accurately.
If the answer isn't in the context, politely state that the information is not available.

CONTEXT:
${context}

QUESTION:
${question}`;

    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error("❌ QUERY ERROR:", error.message);
    throw new Error(`AI processing failed: ${error.message}`);
  }
};

// ==========================
// 🗑 DELETE
// ==========================
export const deleteNamespace = async (namespace) => {
  try {
    const index = getPineconeIndex();
    await index.namespace(namespace).deleteAll();
    console.log(`🗑 Deleted namespace: ${namespace}`);
    return true;
  } catch (error) {
    console.error("❌ DELETE ERROR:", error.message);
    throw new Error(`Failed to delete vectors: ${error.message}`);
  }
};
