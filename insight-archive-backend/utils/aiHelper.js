import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatOpenRouter } from "@langchain/openrouter";

/**
 * Lazy-loads the Pinecone client to ensure process.env variables
 * are loaded before initialization.
 */
const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pc.index(process.env.PINECONE_INDEX_NAME);
};

/**
 * Standardized OpenAI-compatible Embeddings via OpenRouter
 */
const getEmbeddingsConfig = () => {
  return new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
};

/**
 * Splits text into chunks and uploads them to Pinecone.
 */
export const embedAndStore = async (text, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddingsConfig();

    // 1. Chunking Logic
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await splitter.createDocuments([text]);

    console.log(
      `Vectorizing ${docs.length} chunks for namespace: ${namespace}`,
    );

    // 2. Upload to Pinecone
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace,
    });

    return true;
  } catch (error) {
    console.error("AI Helper Error (Embed):", error);
    throw new Error("Failed to index document in vector database.");
  }
};

/**
 * Performs the RAG Query (The Chat Logic).
 */
export const queryDocument = async (question, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddingsConfig();

    // 1. Search Pinecone for the most relevant chunks
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: namespace,
    });

    const results = await vectorStore.similaritySearch(question, 4);
    const context = results.map((r) => r.pageContent).join("\n\n");

    // 2. Initialize OpenRouter Model
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o-mini",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // 3. Generate Answer using Context
    const prompt = `
      Use the following context to answer the user's question. 
      If the answer is not in the context, say you don't know.
      
      CONTEXT:
      ${context}
      
      QUESTION: 
      ${question}
    `;

    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error("Query Error:", error);
    throw new Error("AI failed to process the question.");
  }
};

/**
 * Deletes all vectors within a specific namespace from Pinecone.
 */
export const deleteNamespace = async (namespace) => {
  try {
    const index = getPineconeIndex();

    // Delete operation targeting the specific namespace
    await index.namespace(namespace).deleteAll();

    console.log(`Successfully deleted Pinecone namespace: ${namespace}`);
    return true;
  } catch (error) {
    console.error("Pinecone Deletion Error:", error);
    throw new Error(`Failed to delete vectors: ${error.message}`);
  }
};
