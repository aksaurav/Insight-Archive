import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";

// ✅ Validate ENV early (fail fast)
if (!process.env.GOOGLE_API_KEY) {
  throw new Error("❌ GOOGLE_API_KEY is missing");
}
if (!process.env.PINECONE_API_KEY) {
  throw new Error("❌ PINECONE_API_KEY is missing");
}
if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error("❌ PINECONE_INDEX_NAME is missing");
}

// ✅ Single source of truth for embeddings
const getEmbeddings = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "text-embedding-004", // 768 dimensions
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
    const index = getPineconeIndex();
    const embeddings = getEmbeddings();

    // ✅ Validate input
    if (!text || text.trim().length === 0) {
      throw new Error("No text content found in the document.");
    }

    // ✅ CRITICAL: Verify embeddings actually work
    const testEmbedding = await embeddings.embedQuery("health check");

    console.log("🧪 Test embedding length:", testEmbedding?.length);

    if (!testEmbedding || testEmbedding.length !== 768) {
      throw new Error(
        `Embedding failed. Expected 768, got ${testEmbedding?.length}`,
      );
    }

    // ✅ Split text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const docs = await splitter.createDocuments([text]);

    if (!docs || docs.length === 0) {
      throw new Error("Text splitting resulted in zero documents.");
    }

    console.log(
      `📡 Sending ${docs.length} chunks to Pinecone (namespace: ${namespace})`,
    );

    // ✅ Store vectors
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace,
      textKey: "text",
    });

    console.log("✅ Vector storage successful");

    return true;
  } catch (error) {
    console.error("❌ EMBED ERROR:", error);

    throw new Error(`Vector indexing failed: ${error.message}`);
  }
};

// ==========================
// 🔍 QUERY
// ==========================
export const queryDocument = async (question, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddings();

    if (!question || question.trim().length === 0) {
      throw new Error("Question is empty.");
    }

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace,
      textKey: "text",
    });

    const results = await vectorStore.similaritySearch(question, 4);

    if (!results || results.length === 0) {
      return "No relevant information found in the document.";
    }

    const context = results.map((r) => r.pageContent).join("\n\n");

    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.2,
    });

    const prompt = `Use the following context to answer the user's question.
If the answer is not in the context, say that the information is not available.

CONTEXT:
${context}

QUESTION:
${question}`;

    const response = await model.invoke(prompt);

    return response.content;
  } catch (error) {
    console.error("❌ QUERY ERROR:", error);

    throw new Error(`AI failed to process the question: ${error.message}`);
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
    console.error("❌ DELETE ERROR:", error);

    throw new Error(`Failed to delete vectors: ${error.message}`);
  }
};
