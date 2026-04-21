import { AnalyzeService } from '../services/AnalyzeService.js';
import { calculateEqualityScore } from '../services/vttParser.js';
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
        const filterNoise = req.body.filterNoise === 'true';
        const maxResponseGapSeconds = req.body.maxResponseGapSeconds !== undefined
            ? Number(req.body.maxResponseGapSeconds)
            : undefined;
        const stats = AnalyzeService.analyzeContent(content, { filterNoise, maxResponseGapSeconds });

        res.status(200).json(stats);
    } catch (err) {
        console.error('Error in AnalyzeController:', err);
        if (err.message && err.message.startsWith('Invalid VTT format')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to analyze VTT file' });
    }
}

/**
 * Controller for analyzing ZIP files containing multiple VTTs.
 * Maps to the POST /api/analyze-zip route.
 *
 * Global equality score is computed by pooling all participant word counts
 * and calling calculateEqualityScore once — averaging per-file Gini scores
 * is statistically incorrect.
 *
 * Global WPM uses total speaking time (sum of per-file speakingSeconds) so
 * long silences between sessions do not deflate the metric.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export function analyzeZip(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filterNoise = req.body.filterNoise === 'true';
        const maxResponseGapSeconds = req.body.maxResponseGapSeconds !== undefined
            ? Number(req.body.maxResponseGapSeconds)
            : undefined;
        const zip = new AdmZip(req.file.buffer);
        const zipEntries = zip.getEntries();
        const results = [];

        let totalDurationSeconds = 0;
        let totalSpeakingSeconds = 0;
        let totalMessages = 0;
        let totalWords = 0;
        let totalNoiseMessages = 0;
        let totalBackchannels = 0;
        let totalInterruptions = 0;
        let globalNoiseBreakdown = { duration: 0, logistics: 0, backchannel: 0, other: 0 };
        let participantMap = new Map();
        // Weighted mean: sum(mean_i * count_i) / sum(count_i) — statistically correct
        let sumWeightedResponseTime = 0;
        let totalResponseTimeCount = 0;
        // Pool totals for noise ratio: totalNoise / totalMergedCues — statistically correct
        let totalMergedCues = 0;
        let vttFileCount = 0;

        zipEntries.forEach(entry => {
            if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.vtt')) {
                const content = entry.getData().toString('utf-8');
                const stats = AnalyzeService.analyzeContent(content, { filterNoise, maxResponseGapSeconds });

                totalDurationSeconds      += stats.durationSeconds;
                totalSpeakingSeconds      += stats.speakingSeconds || 0;
                totalMessages             += stats.totalMessages;
                totalWords                += stats.totalWords;
                totalNoiseMessages        += stats.noiseMessagesCount;
                totalBackchannels         += stats.backchannelCount;
                totalInterruptions        += stats.interruptionCount;
                totalMergedCues           += stats.mergedCuesCount  || 0;
                sumWeightedResponseTime   += stats.meanResponseTimeSeconds * (stats.responseTimeCount || 0);
                totalResponseTimeCount    += stats.responseTimeCount || 0;
                vttFileCount++;

                if (stats.noiseBreakdown) {
                    globalNoiseBreakdown.duration   += stats.noiseBreakdown.duration   || 0;
                    globalNoiseBreakdown.logistics  += stats.noiseBreakdown.logistics  || 0;
                    globalNoiseBreakdown.backchannel+= stats.noiseBreakdown.backchannel|| 0;
                    globalNoiseBreakdown.other      += stats.noiseBreakdown.other      || 0;
                }

                stats.participants.forEach(p => {
                    const existing = participantMap.get(p.name) || { count: 0, words: 0, speakingSeconds: 0 };
                    participantMap.set(p.name, {
                        count:          existing.count          + p.count,
                        words:          existing.words          + p.words,
                        speakingSeconds: existing.speakingSeconds + (p.speakingSeconds || 0),
                    });
                });

                results.push({ filename: entry.name, ...stats });
            }
        });

        if (results.length === 0) {
            return res.status(400).json({ error: 'No VTT files found in ZIP' });
        }

        const durationMinutes   = Number((totalDurationSeconds / 60).toFixed(2));
        const speakingMinutes   = totalSpeakingSeconds / 60;

        // Single Gini pass over pooled participant word counts — statistically correct
        const globalEqualityScore = calculateEqualityScore(
            Array.from(participantMap.values()).map(d => d.words)
        );

        const globalStats = {
            durationSeconds:        Number(totalDurationSeconds.toFixed(3)),
            durationMinutes,
            speakingSeconds:        Number(totalSpeakingSeconds.toFixed(3)),
            meanResponseTimeSeconds: totalResponseTimeCount > 0
                ? Number((sumWeightedResponseTime / totalResponseTimeCount).toFixed(2))
                : 0,
            participantCount:       participantMap.size,
            equalityScore:          globalEqualityScore,
            totalMessages,
            totalWords,
            wpm: speakingMinutes > 0 ? Number((totalWords / speakingMinutes).toFixed(2)) : 0,
            noiseMessagesCount:     totalNoiseMessages,
            noiseBreakdown:         globalNoiseBreakdown,
            backchannelCount:       totalBackchannels,
            interruptionCount:      totalInterruptions,
            noiseRatio: totalMergedCues > 0
                ? Number(((totalNoiseMessages / totalMergedCues) * 100).toFixed(1))
                : 0,
            participants: Array.from(participantMap.entries())
                .map(([name, data]) => ({
                    name,
                    count: data.count,
                    words: data.words,
                    speakingSeconds: Number(data.speakingSeconds.toFixed(3)),
                    wpm: data.speakingSeconds > 0
                        ? Number((data.words / (data.speakingSeconds / 60)).toFixed(2))
                        : 0,
                }))
                .sort((a, b) => b.count - a.count),
        };

        // Generate CSV
        const headers = [
            'filename', 'durationSeconds', 'durationMinutes', 'meanResponseTimeSeconds',
            'participantCount', 'totalMessages', 'totalWords', 'wpm',
            'noiseMessagesCount', 'backchannelCount', 'interruptionCount', 'noiseRatio',
            'participants',
        ];
        // escapeCsvText: escapes text fields (strings) for semicolon-delimited CSV.
        // Wraps in quotes if the value contains semicolons, quotes, or newlines.
        const escapeCsvText = (val) => {
            if (val === undefined || val === null) return '';
            const str = String(val);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // formatNum: converts numeric values to Spanish/EU locale format
        // (decimal comma, no thousand separator) so LibreOffice and Google
        // Sheets recognise them as numbers when using semicolon as delimiter.
        const formatNum = (val) => {
            if (val === undefined || val === null || val === '') return '';
            const n = Number(val);
            if (isNaN(n)) return String(val);
            return String(n).replace('.', ',');
        };

        const csvLines = [headers.join(';')];
        results.forEach(item => {
            const participantsStr = item.participants
                ? item.participants.map(p => `${p.name} (turns: ${p.count}, words: ${p.words})`).join('; ')
                : '';
            const row = [
                escapeCsvText(item.filename),
                formatNum(item.durationSeconds),
                formatNum(item.durationMinutes),
                formatNum(item.meanResponseTimeSeconds),
                formatNum(item.participantCount),
                formatNum(item.totalMessages),
                formatNum(item.totalWords),
                formatNum(item.wpm),
                formatNum(item.noiseMessagesCount),
                formatNum(item.backchannelCount),
                formatNum(item.interruptionCount),
                formatNum(item.noiseRatio),
                escapeCsvText(participantsStr),
            ];
            csvLines.push(row.join(';'));
        });

        // Append a GLOBAL TOTAL summary row at the bottom of the CSV
        const globalParticipantsStr = globalStats.participants
            ? globalStats.participants.map(p => `${p.name} (turns: ${p.count}, words: ${p.words})`).join('; ')
            : '';
        const globalRow = [
            escapeCsvText('GLOBAL TOTAL'),
            formatNum(globalStats.durationSeconds),
            formatNum(globalStats.durationMinutes),
            formatNum(globalStats.meanResponseTimeSeconds),
            formatNum(globalStats.participantCount),
            formatNum(globalStats.totalMessages),
            formatNum(globalStats.totalWords),
            formatNum(globalStats.wpm),
            formatNum(globalStats.noiseMessagesCount),
            formatNum(globalStats.backchannelCount),
            formatNum(globalStats.interruptionCount),
            formatNum(globalStats.noiseRatio),
            escapeCsvText(globalParticipantsStr),
        ];
        csvLines.push(globalRow.join(';'));

        res.status(200).json({
            csv: csvLines.join('\n'),
            globalStats,
            results,
        });
    } catch (err) {
        console.error('Error in analyzeZip controller:', err);
        res.status(500).json({ error: 'Failed to process ZIP file' });
    }
}
