import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import docRoutes from "./routes/documentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();

// MongoDB Connection
connectDB();

// Updated CORS to allow all Vercel previews and your main domain
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedPatterns = [
        "https://insight-archive-silk.vercel.app",
        /vercel\.app$/, // Allows all Vercel preview deployments
        "http://localhost:5173",
      ];

      if (
        !origin ||
        allowedPatterns.some((pattern) =>
          typeof pattern === "string"
            ? pattern === origin
            : pattern.test(origin),
        )
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

// Routes
app.use("/api/docs", docRoutes);
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
