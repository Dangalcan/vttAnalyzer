import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Standard middleware
app.use(express.json());

// Serve static files from the root public directory
app.use(express.static(path.join(__dirname, '../public')));

// Register API routes
app.use('/api', apiRouter);

// Start server
app.listen(port, () => {
    console.log(`VTT Analyzer server running at http://localhost:${port}`);
});
