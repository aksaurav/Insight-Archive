import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/docs/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const askQuestion = (question, docId) => {
  return API.post("/chat/query", { question, docId });
};

export const deleteDoc = (docId) => {
  return API.delete(`/docs/${docId}`);
};

export const fetchChatHistory = (docId) => API.get(`/chat/history${docId}`);

export const fetchDocuments = () => API.get("/docs");
