import express from "express";
const router = express.Router();
import {
  askQuestion,
  chatWithDocument,
  getChatHistory,
} from "../controllers/chatController.js";

router.post("/query", chatWithDocument);
router.get("/history/:docId", getChatHistory);
router.post("/query", askQuestion);

export default router;
