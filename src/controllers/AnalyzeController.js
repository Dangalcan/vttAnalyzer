import { AnalyzeService } from '../services/AnalyzeService.js';
import AdmZip from 'adm-zip';

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

/**
 * Controller for analyzing ZIP files containing multiple VTTs.
 * Maps to the POST /api/analyze-zip route.
 * 
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export function analyzeZip(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const zip = new AdmZip(req.file.buffer);
        const zipEntries = zip.getEntries();
        const results = [];

        zipEntries.forEach(entry => {
            if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.vtt')) {
                const content = entry.getData().toString('utf-8');
                const stats = AnalyzeService.analyzeContent(content);
                results.push({
                    filename: entry.name,
                    ...stats
                });
            }
        });

        if (results.length === 0) {
            return res.status(400).json({ error: 'No VTT files found in ZIP' });
        }

        // Generate CSV
        const headers = ['filename', 'durationSeconds', 'durationMinutes', 'meanResponseTimeSeconds', 'participantCount', 'totalMessages', 'participants'];
        const escapeCsv = (val) => {
            if (val === undefined || val === null) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvLines = [headers.join(',')];
        results.forEach(item => {
            const participantsStr = item.participants
                ? item.participants.map(p => `${p.name} (${p.count})`).join('; ')
                : '';
            const row = [
                escapeCsv(item.filename),
                escapeCsv(item.durationSeconds),
                escapeCsv(item.durationMinutes),
                escapeCsv(item.meanResponseTimeSeconds),
                escapeCsv(item.participantCount),
                escapeCsv(item.totalMessages),
                escapeCsv(participantsStr)
            ];
            csvLines.push(row.join(','));
        });

        const csvString = csvLines.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analysis.csv"');
        res.status(200).send(csvString);
    } catch (err) {
        console.error('Error in analyzeZip controller:', err);
        res.status(500).json({ error: 'Failed to process ZIP file' });
    }
}
