import React, { useState, useEffect, useRef } from "react";
import {
  uploadFile,
  askQuestion,
  deleteDoc,
  fetchDocuments,
  fetchChatHistory,
} from "./services/api";
import {
  Upload,
  Send,
  FileText,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";

function App() {
  const [documents, setDocuments] = useState([]);
  const [docData, setDocData] = useState(null);
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null); // Ref to safely reset the native HTML file input element

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const loadLibrary = async () => {
    try {
      const res = await fetchDocuments();
      setDocuments(res.data);
    } catch (err) {
      console.error("Failed to load document library:", err.response?.data || err.message);
    }
  };

  // Handle Selecting a Document & Loading History
  const handleSelectDocument = async (doc) => {
    if (!doc || !doc._id) {
      console.error("Invalid document selected");
      return;
    }

    setDocData(doc);
    setChat([]); // Clear UI state immediately to prevent flicker
    setIsLoadingHistory(true);

    try {
      const docId = String(doc._id).trim();
      const res = await fetchChatHistory(docId);

      if (res.data && res.data.length > 0) {
        setChat(res.data);
      } else {
        setChat([
          {
            role: "ai",
            content: `No previous history for "${doc.fileName}". Ask your first question!`,
          },
        ]);
      }
    } catch (err) {
      console.error("Error loading chat history:", err.response?.data || err.message);
      setChat([
        {
          role: "ai",
          content: "Could not load history. You can still ask new questions.",
        },
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpload = async () => {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      const newDoc = res.data.document;
      
      // Reset local file state
      setFile(null);
      
      // Reset actual DOM input element value so the same file can be re-selected if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }

      await loadLibrary();
      // Automatically select the new document and start context
      handleSelectDocument(newDoc);
    } catch (err) {
      console.error("Error uploading file details:", err.response?.data || err.message);
      alert("Error uploading file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    // Guard clause to prevent empty questions or requests while querying/loading
    if (!question.trim() || !docData || isQuerying || isLoadingHistory) return;

    const userMsg = { role: "user", content: question };
    setChat((prev) => [...prev, userMsg]);
    const currentQuestion = question;
    setQuestion("");
    setIsQuerying(true);

    try {
      // Passing both currentQuestion and document ID (_id matches documentId)
      const res = await askQuestion(currentQuestion, docData._id);
      setChat((prev) => [...prev, { role: "ai", content: res.data.answer }]);
    } catch (err) {
      console.error("Query failed details:", err.response?.data || err.message);
      setChat((prev) => [
        ...prev,
        { role: "ai", content: "Error processing request." },
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Permanently delete this document and its AI index?"))
      return;

    try {
      await deleteDoc(id);
      if (docData?._id === id) {
        setDocData(null);
        setChat([]);
      }
      loadLibrary();
    } catch (err) {
      console.error("Delete failed details:", err.response?.data || err.message);
      alert("Delete failed.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Sparkles size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Insight Archive
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            onClick={() => {
              setDocData(null);
              setChat([]);
            }}
            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all border border-slate-600/50"
          >
            <Plus size={18} /> New Analysis
          </button>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 mb-2">
              Recent Documents
            </p>
            {documents.map((doc) => (
              <div
                key={doc._id}
                onClick={() => handleSelectDocument(doc)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  docData?._id === doc._id
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-100 shadow-lg shadow-blue-900/20"
                    : "bg-transparent border-transparent hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <FileText
                    size={16}
                    className={
                      docData?._id === doc._id
                        ? "text-blue-400"
                        : "text-slate-500"
                    }
                  />
                  <span className="text-sm font-medium truncate">
                    {doc.fileName}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(doc._id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN WORK AREA */}
      <main className="flex-1 flex flex-col bg-slate-900 relative">
        {!docData ? (
          /* UPLOAD VIEW */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl w-full bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-3xl p-12 text-center">
              <div className="bg-blue-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                <Upload size={36} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">
                Upload for Insight
              </h2>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                Select a PDF to vectorize and start an AI-powered conversation.
              </p>

              <input
                type="file"
                id="file-upload"
                ref={fileInputRef} // Assigned the ref to clear value programmatically
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                accept=".pdf"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-2xl inline-flex items-center gap-3 mb-6 transition-all font-medium border border-slate-600/50 text-white"
              >
                <FileText size={20} className="text-blue-400" />
                {file ? file.name : "Choose PDF Document"}
              </label>

              {file && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all"
                >
                  {isUploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus size={20} />
                  )}
                  {isUploading
                    ? "Building Vector Knowledge..."
                    : "Index Document"}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* CHAT VIEW */
          <div className="flex-1 flex flex-col h-full max-w-5xl mx-auto w-full">
            <div className="p-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                  <FileText size={24} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">
                    {docData.fileName}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <span
                      className={`w-2 h-2 rounded-full ${isLoadingHistory ? "bg-yellow-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`}
                    ></span>
                    {isLoadingHistory
                      ? "Restoring memory..."
                      : "Active Context"}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-4 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex w-10 h-10 rounded-xl items-center justify-center shrink-0 border ${
                        msg.role === "user"
                          ? "bg-blue-600 border-blue-400/30"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User size={20} />
                      ) : (
                        <Bot size={20} />
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {(isQuerying || isLoadingHistory) && (
                <div className="flex justify-start items-center gap-3">
                  <div className="bg-slate-800 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700">
                    <Loader2 size={18} className="animate-spin text-blue-400" />
                  </div>
                  <div className="bg-slate-800/50 px-4 py-2 rounded-full text-slate-500 text-xs font-medium italic border border-slate-800 animate-pulse">
                    {isLoadingHistory
                      ? "Fetching history..."
                      : "Scanning vectors for answers..."}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sticky Input */}
            <div className="p-6 pt-0">
              <form
                onSubmit={handleQuery}
                className="relative group max-w-4xl mx-auto"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`Ask anything about ${docData.fileName}...`}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:border-blue-500/50 text-white shadow-2xl"
                />
                <button
                  type="submit"
                  disabled={isQuerying || isLoadingHistory || !question.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 p-2.5 rounded-xl transition-all text-white"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
