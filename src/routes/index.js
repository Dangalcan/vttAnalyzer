import express from 'express';
import multer from 'multer';
import { analyzeVTT, analyzeZip } from '../controllers/AnalyzeController.js';

const router = express.Router();

// Configuration for Multer (storing files in memory as buffers)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * API Routes definition.
 */

// POST /api/analyze - Uploads and analyzes a VTT file
router.post('/analyze', upload.single('vttFile'), analyzeVTT);

// POST /api/analyze-zip - Uploads and analyzes a ZIP of VTT files
router.post('/analyze-zip', upload.single('vttFile'), analyzeZip);

export default router;
