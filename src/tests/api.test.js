import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import AdmZip from 'adm-zip';

describe('VTT Analyzer API', () => {
    describe('POST /api/analyze', () => {
        it('should return stats for a valid VTT file', async () => {
            const vttContent = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Speaker 1>Hello';
            const response = await request(app)
                .post('/api/analyze')
                .attach('vttFile', Buffer.from(vttContent), 'test.vtt');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('durationSeconds');
            expect(response.body.participantCount).toBe(1);
        });

        it('should return 400 if no file is uploaded', async () => {
            const response = await request(app).post('/api/analyze');
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('No file uploaded');
        });
    });

    describe('POST /api/analyze-zip', () => {
        it('should return a CSV for a valid ZIP with multiple VTTs', async () => {
            const zip = new AdmZip();
            zip.addFile('file1.vtt', Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Speaker 1>File 1'));
            zip.addFile('file2.vtt', Buffer.from('WEBVTT\n\n00:00:03.000 --> 00:00:04.000\n<v Speaker 2>File 2'));
            const zipBuffer = zip.toBuffer();

            const response = await request(app)
                .post('/api/analyze-zip')
                .attach('vttFile', zipBuffer, 'batch.zip');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('application/json');
            expect(response.body).toHaveProperty('csv');
            expect(response.body).toHaveProperty('globalStats');
            expect(response.body.csv).toContain('file1.vtt');
            expect(response.body.csv).toContain('file2.vtt');
            expect(response.body.globalStats.totalMessages).toBe(2);
        });

        it('should handle VTT files in subdirectories', async () => {
            const zip = new AdmZip();
            zip.addFile('subdir/file3.vtt', Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Speaker 3>Subdir file'));
            const zipBuffer = zip.toBuffer();

            const response = await request(app)
                .post('/api/analyze-zip')
                .attach('vttFile', zipBuffer, 'batch.zip');

            expect(response.status).toBe(200);
            expect(response.body.csv).toContain('file3.vtt');
        });

        it('should return 400 if ZIP contains no VTT files', async () => {
            const zip = new AdmZip();
            zip.addFile('readme.txt', Buffer.from('Not a VTT'));
            const zipBuffer = zip.toBuffer();

            const response = await request(app)
                .post('/api/analyze-zip')
                .attach('vttFile', zipBuffer, 'batch.zip');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('No VTT files found in ZIP');
        });

        it('should return 400 if no file is uploaded', async () => {
            const response = await request(app).post('/api/analyze-zip');
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('No file uploaded');
        });
        
        it('should return 500 for a corrupted ZIP file', async () => {
           const response = await request(app)
               .post('/api/analyze-zip')
               .attach('vttFile', Buffer.from('not a zip'), 'bad.zip');
           
           expect(response.status).toBe(500);
           expect(response.body.error).toBe('Failed to process ZIP file');
        });
    });
});
