import express from 'express';
import multer from 'multer';
import { analyzeVTT } from '../controllers/AnalyzeController.js';

const router = express.Router();

// Configuration for Multer (storing files in memory as buffers)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * API Routes definition.
 */

// POST /api/analyze - Uploads and analyzes a VTT file
router.post('/analyze', upload.single('vttFile'), analyzeVTT);

export default router;
