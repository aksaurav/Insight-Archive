import express from "express";
import multer from "multer";
import {
  uploadDocument,
  deleteDocument,
  getAllDocuments,
} from "../controllers/uploadController.js";

const router = express.Router();

// Config Multer to store file in memory (RAM) instead of disk
// This is faster and better for 8GB RAM as we don't need to clean up temp files
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/docs/upload
router.post("/upload", upload.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);
router.get("/", getAllDocuments);
export default router;
