import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append("file", file); // Ensure backend upload.single('file') matches this key
  return API.post("/docs/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const askQuestion = (question, namespace) => {
  return API.post("/chat/query", { question, namespace });
};

export const deleteDoc = (docId) => {
  return API.delete(`/docs/${docId}`);
};

export const fetchChatHistory = (docId) =>
  API.get(`/chat/history/${docId.trim()}`);

export const fetchDocuments = () => API.get("/docs");
