import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

// Helper for consistent embedding configuration
const getEmbeddingsConfig = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "text-embedding-004", // 768 dimensions matching your Pinecone index
  });
};

const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pc.index(process.env.PINECONE_INDEX_NAME);
};

export const embedAndStore = async (text, namespace) => {
  try {
    const index = getPineconeIndex();

    // Explicitly configure for the 768-dimension model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT, // Optimization for RAG
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const docs = await splitter.createDocuments([text]);

    // Added verification: Log the number of documents being sent
    console.log(
      `Sending ${docs.length} chunks to Pinecone for namespace: ${namespace}`,
    );

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace,
      textKey: "text",
    });

    return true;
  } catch (error) {
    console.error("AI HELPER FAILURE:", error.message);
    throw new Error(`Vector indexing failed: ${error.message}`);
  }
};

export const queryDocument = async (question, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddingsConfig();

    // Initialize the vector store to search the specific namespace
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: namespace,
      textKey: "text",
    });

    // 1. Retrieve the most relevant 4 chunks
    const results = await vectorStore.similaritySearch(question, 4);
    const context = results.map((r) => r.pageContent).join("\n\n");

    // 2. Initialize Gemini 1.5 Flash for the answer
    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.2, // Lower temperature for more factual answers
    });

    const prompt = `Use the following context to answer the user's question. 
If the answer is not in the context, say that the information is not available in the document.

CONTEXT:
${context}

QUESTION: 
${question}`;

    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error("Gemini Query Error:", error.message);
    throw new Error(`AI failed to process the question: ${error.message}`);
  }
};

export const deleteNamespace = async (namespace) => {
  try {
    const index = getPineconeIndex();
    await index.namespace(namespace).deleteAll();
    return true;
  } catch (error) {
    console.error("Pinecone Deletion Error:", error);
    throw new Error(`Failed to delete vectors: ${error.message}`);
  }
};
