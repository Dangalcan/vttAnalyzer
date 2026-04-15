import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import he from 'he';
import path from 'path';
import { parseVTT } from './vttParser.js';

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));


app.post('/api/analyze', upload.single('vttFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const content = req.file.buffer.toString('utf-8');
        const stats = parseVTT(content);
        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to parse VTT file' });
    }
});

app.listen(port, () => {
    console.log(`VTT Analyzer server running at http://localhost:${port}`);
});
