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

export const askQuestion = (question, namespace) => {
  return API.post("/chat/query", { question, namespace });
};

export const deleteDoc = (docId) => {
  return API.delete(`/docs/${docId}`);
};

export const fetchChatHistory = (docId) => {
  const cleanId = String(docId).trim();
  // Using a comma in console.log to see the value clearly in the browser
  console.log("📡 API Call - ID:", cleanId);

  // Hard-coded leading slash for the ID
  return API.get(`/chat/history/` + cleanId);
};
export const fetchDocuments = () => API.get("/docs");
