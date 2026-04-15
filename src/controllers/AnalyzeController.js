import { AnalyzeService } from '../services/AnalyzeService.js';

/**
 * Controller for analyzing VTT files.
 * Maps to the POST /api/analyze route.
 * 
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export function analyzeVTT(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const content = req.file.buffer.toString('utf-8');
        const stats = AnalyzeService.analyzeContent(content);
        
        // Return JSON results directly
        res.status(200).json(stats);
    } catch (err) {
        console.error('Error in AnalyzeController:', err);
        res.status(500).json({ error: 'Failed to analyze VTT file' });
    }
}
