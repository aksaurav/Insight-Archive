import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "https://insight-archive-silk.vercel.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

// Basic Health Check Route
app.get("/", (req, res) => res.send(`Insight-Archive API Running`));

// Doc Routes
import documentRoutes from "./routes/documentRoutes.js";
app.use("/api/docs", documentRoutes);

// chat routes
import chatRoutes from "./routes/chatRoutes.js";
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on PORT: ${PORT}`));
