import express from 'express';
import multer from 'multer';
import { analyzeVTT, analyzeZip } from '../controllers/AnalyzeController.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB cap

/**
 * Wraps a multer single-file middleware and converts LIMIT_FILE_SIZE errors
 * into a proper 413 response before they reach the controller.
 */
function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File too large. Maximum allowed size is 50 MB.' });
            }
            if (err) return next(err);
            next();
        });
    };
}

// POST /api/analyze — single VTT file
router.post('/analyze',     handleUpload(upload.single('vttFile')), analyzeVTT);

// POST /api/analyze-zip — ZIP archive of VTT files
router.post('/analyze-zip', handleUpload(upload.single('vttFile')), analyzeZip);

export default router;
