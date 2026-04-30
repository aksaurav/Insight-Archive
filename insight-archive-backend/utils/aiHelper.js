import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatOpenRouter } from "@langchain/openrouter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const getPineconeIndex = () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pc.index(process.env.PINECONE_INDEX_NAME);
};

export const embedAndStore = async (text, namespace) => {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX_NAME);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "text-embedding-004",
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500, // Reduced from 1000 to save memory on Render
      chunkOverlap: 50,
    });

    const docs = await splitter.createDocuments([text]);

    // Added a more direct initialization to prevent the 502 timeout
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
