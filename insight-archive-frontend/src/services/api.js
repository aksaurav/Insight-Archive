import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "https://insight-archive.onrender.com/api",
});

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append("file", file); // Ensure backend upload.single('file') matches this key
  return API.post("/docs/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// --- FIXED: Changed payload key from 'namespace' to 'documentId' ---
export const askQuestion = (question, documentId) => {
  return API.post("/chat/query", { 
    question, 
    documentId 
  });
};

export const deleteDoc = (docId) => {
  return API.delete(`/docs/${docId}`);
};

export const fetchChatHistory = (docId) => {
  const cleanId = String(docId).trim();
  console.log("📡 API Call - ID:", cleanId);
  return API.get(`/chat/history/` + cleanId);
};

export const fetchDocuments = () => API.get("/docs");
