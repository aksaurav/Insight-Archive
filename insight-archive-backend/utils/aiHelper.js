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
  return new OpenAIEmbeddings({
    // Using OpenRouter key here
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    // This MUST match your Pinecone dimensions (1536)
    modelName: "openai/text-embedding-3-small",
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      // Specifically for OpenRouter headers
      defaultHeaders: {
        "HTTP-Referer": "https://insight-archive.onrender.com",
        "X-Title": "Insight Archive",
      },
    },
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

    console.log(
      `Vectorizing ${docs.length} chunks for namespace: ${namespace}`,
    );

    // Using PineconeStore's static method
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace,
      textKey: "text", // Explicitly define the text key
    });

    return true;
  } catch (error) {
    // Log the actual error response from OpenRouter/Pinecone
    console.error(
      "DETAILED EMBED ERROR:",
      error.response?.data || error.message,
    );
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

    const model = new ChatOpenRouter({
      model: "openai/gpt-4o-mini",
      apiKey: process.env.OPENROUTER_API_KEY,
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
    console.error(
      "Detailed Query Error:",
      error.response?.data || error.message,
    );
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
