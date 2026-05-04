import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { CohereEmbeddings } from "@langchain/cohere"; // Changed from OpenAI
import { ChatGroq } from "@langchain/groq";

// ==========================
// ✅ ENV VALIDATION
// ==========================
const validateEnv = () => {
  const keys = [
    "GROQ_API_KEY",
    "COHERE_API_KEY", // Changed from OPENAI_API_KEY
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
  ];
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
  return new CohereEmbeddings({
    apiKey: process.env.COHERE_API_KEY,
    // Note: This model produces 1024 dimensions.
    // IMPORTANT: You MUST update your Pinecone index dimensions to 1024.
    model: "embed-english-v3.0",
    inputType: "search_document",
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

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });

    const docs = await splitter.createDocuments([text]);

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
// 🔍 QUERY (Powered by Groq)
// ==========================
export const queryDocument = async (question, namespace) => {
  try {
    validateEnv();
    const index = getPineconeIndex();

    // For queries, we use a specific inputType for better retrieval accuracy
    const queryEmbeddings = new CohereEmbeddings({
      apiKey: process.env.COHERE_API_KEY,
      model: "embed-english-v3.0",
      inputType: "search_query",
    });

    const vectorStore = await PineconeStore.fromExistingIndex(queryEmbeddings, {
      pineconeIndex: index,
      namespace,
      textKey: "text",
    });

    const results = await vectorStore.similaritySearch(question, 4);

    if (!results || results.length === 0) {
      return "I couldn't find any relevant information in that document.";
    }

    const context = results.map((r) => r.pageContent).join("\n\n");

    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
    });

    const prompt = `You are a professional AI assistant. Use the provided context to answer the question accurately. 
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
