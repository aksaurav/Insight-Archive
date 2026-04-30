import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatOpenRouter } from "@langchain/openrouter";

const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pc.index(process.env.PINECONE_INDEX_NAME);
};

const getEmbeddingsConfig = () => {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "text-embedding-004",
    maxRetries: 2,
  });
};
export const embedAndStore = async (text, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddingsConfig();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await splitter.createDocuments([text]);

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace,
    });

    return true;
  } catch (error) {
    console.error("Gemini Embed Error:", error);
    throw new Error("Failed to index document in vector database.");
  }
};

export const queryDocument = async (question, namespace) => {
  try {
    const index = getPineconeIndex();
    const embeddings = getEmbeddingsConfig();

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: namespace,
    });

    const results = await vectorStore.similaritySearch(question, 4);
    const context = results.map((r) => r.pageContent).join("\n\n");

    // Using Gemini 1.5 Flash (very fast and free)
    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const prompt = `Use the following context to answer the user's question. 
If the answer is not in the context, say you don't know.

CONTEXT:
${context}

QUESTION: 
${question}`;

    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error("Gemini Query Error:", error);
    throw new Error("AI failed to process the question.");
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
