import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRouter);

// Start server only if run directly
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    const server = app.listen(port, () => {
        console.log(`VTT Analyzer server running at http://localhost:${port}`);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`\x1b[31m[ERROR]\x1b[0m Port ${port} is already in use.`);
            console.error(`Please run: \x1b[36mnetstat -ano | findstr :${port}\x1b[0m to find the PID and kill it, or use a different port.`);
            process.exit(1);
        }
    });
}

export default app;
