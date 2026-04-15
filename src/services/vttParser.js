import he from 'he';
import { filterCues, NOISE_DEFAULTS } from './noiseFilter.js';

/**
 * Calculates the Gini Coefficient (Participation Equality).
 * 100% means perfect equality, 0% means total dominance by one.
 *
 * Exported so the ZIP controller can compute a single global score from
 * pooled participant word counts rather than averaging per-file scores.
 */
export function calculateEqualityScore(values) {
    if (!values || values.length <= 1) return 100;
    const n = values.length;
    let sumDiff = 0;
    let sumValues = 0;

    for (let i = 0; i < n; i++) {
        sumValues += values[i];
        for (let j = 0; j < n; j++) {
            sumDiff += Math.abs(values[i] - values[j]);
        }
    }

    if (sumValues === 0) return 100;
    const gini = sumDiff / (2 * (n ** 2) * (sumValues / n));
    return Number(((1 - gini) * 100).toFixed(1));
}

/**
 * Normalizes a speaker name for scientific consistency.
 */
function normalizeName(name) {
    if (!name) return 'Unknown';
    return name.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function parseTimestampToSeconds(ts) {
    if (!ts) return 0;
    const [hms, ms] = ts.split('.');
    if (!hms || !ms) return 0;
    const parts = hms.split(':').map(Number);
    if (parts.length !== 3) return 0;
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

function calculateDuration(start, end) {
    if (!start || !end) return 0;
    return Number((parseTimestampToSeconds(end) - parseTimestampToSeconds(start)).toFixed(3));
}

/**
 * Parses VTT content and returns conversation statistics.
 *
 * WPM is computed from actual speaking time (sum of finalCue durations)
 * rather than wall-clock session duration, so long silences do not
 * artificially deflate the metric.
 *
 * noiseRatio uses mergedCues.length as the denominator because filtering
 * operates on merged cues, not raw cues.
 */
function parseVTT(content, options = { filterNoise: true }) {
    if (!content || !content.trimStart().startsWith('WEBVTT')) {
        throw new Error('Invalid VTT format: missing WEBVTT header');
    }

    const lines = content.split(/\r?\n/);
    const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
    const voiceRegex = /<v ([^>]+)>/;

    const rawCues = [];
    let currentCue = null;
    let rawTranscriptText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line === 'WEBVTT') continue;

        const tsMatch = line.match(timestampRegex);
        if (tsMatch) {
            if (currentCue) rawCues.push(currentCue);
            currentCue = {
                start: tsMatch[1],
                end: tsMatch[2],
                startSec: parseTimestampToSeconds(tsMatch[1]),
                endSec: parseTimestampToSeconds(tsMatch[2]),
                duration: calculateDuration(tsMatch[1], tsMatch[2]),
                speaker: null,
                text: ''
            };
            continue;
        }

        if (currentCue) {
            const vMatch = line.match(voiceRegex);
            if (vMatch) {
                currentCue.speaker = normalizeName(he.decode(vMatch[1]));
            }
            if (!line.match(timestampRegex) && !/^\d+$/.test(line) && !/^[a-z0-9-]{10,}/.test(line)) {
                rawTranscriptText += line + '\n';
                const cleanText = line
                    .replace(/<[^>]+>/g, '')
                    .replace(/\[.*?\]|\(.*?\)/g, '')
                    .trim();
                if (cleanText) {
                    currentCue.text += (currentCue.text ? ' ' : '') + cleanText;
                }
            }
        }
    }
    if (currentCue) rawCues.push(currentCue);

    // Merge shadow cues (same speaker, gap < mergeGapThreshold)
    const mergeGapThreshold = options.mergeGapThreshold ?? NOISE_DEFAULTS.mergeGapThreshold;
    const mergedCues = [];
    if (rawCues.length > 0) {
        let activeCue = JSON.parse(JSON.stringify(rawCues[0]));
        for (let i = 1; i < rawCues.length; i++) {
            const next = rawCues[i];
            const gap = next.startSec - activeCue.endSec;
            if (next.speaker === activeCue.speaker && gap < mergeGapThreshold) {
                activeCue.end = next.end;
                activeCue.endSec = next.endSec;
                activeCue.duration = calculateDuration(activeCue.start, activeCue.end);
                activeCue.text += ' ' + next.text;
            } else {
                mergedCues.push(activeCue);
                activeCue = JSON.parse(JSON.stringify(next));
            }
        }
        mergedCues.push(activeCue);
    }

    const { finalCues, breakdown, backchannelCount } = filterCues(mergedCues, options);

    const participants = {};
    let totalMessages = 0;
    let totalWords = 0;
    let totalSpeakingSeconds = 0;
    let responseTimes = [];
    let interruptionCount = 0;
    let previousSpeaker = null;
    let previousSpeakerEnd = 0;
    let firstTs = null;
    let lastTs = null;
    let cleanTranscriptText = '';

    finalCues.forEach(cue => {
        const words = cue.text.trim().split(/\s+/).filter(w => w.length > 0);
        const pName = cue.speaker;

        if (!participants[pName]) {
            participants[pName] = { count: 0, words: 0, speakingSeconds: 0 };
        }
        participants[pName].count++;
        participants[pName].words += words.length;
        participants[pName].speakingSeconds += cue.duration;

        totalMessages++;
        totalWords += words.length;
        totalSpeakingSeconds += cue.duration;
        cleanTranscriptText += `[${cue.start}] ${pName}: ${cue.text}\n\n`;

        if (!firstTs) firstTs = cue.start;
        if (!lastTs || cue.endSec > parseTimestampToSeconds(lastTs)) lastTs = cue.end;

        if (previousSpeaker !== null) {
            if (previousSpeaker !== pName) {
                if (cue.startSec < previousSpeakerEnd - 0.5) interruptionCount++;
                const gap = cue.startSec - previousSpeakerEnd;
                if (gap <= 300) responseTimes.push(Math.max(0, gap));
            }
        }
        previousSpeaker = pName;
        previousSpeakerEnd = Math.max(previousSpeakerEnd, cue.endSec);
    });

    const durationSeconds = Number(calculateDuration(firstTs, lastTs).toFixed(3));
    const durationMinutes = Number((durationSeconds / 60).toFixed(2));
    const speakingMinutes = totalSpeakingSeconds / 60;
    const equalityScore = calculateEqualityScore(Object.values(participants).map(p => p.words));
    const totalNoise = breakdown.duration + breakdown.logistics + breakdown.backchannel + breakdown.other;
    // Use mergedCues.length: filtering operates on merged cues, not raw cues
    const noiseRatio = mergedCues.length > 0
        ? Number(((totalNoise / mergedCues.length) * 100).toFixed(1))
        : 0;

    if (rawTranscriptText.trim() === '') rawTranscriptText = '(No raw text detected)';
    if (cleanTranscriptText.trim() === '') cleanTranscriptText = '(Scientific filtering removed all content)';

    return {
        durationSeconds,
        durationMinutes,
        speakingSeconds: Number(totalSpeakingSeconds.toFixed(3)),
        meanResponseTimeSeconds: responseTimes.length > 0
            ? Number((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2))
            : 0,
        participantCount: Object.keys(participants).length,
        equalityScore,
        participants: Object.entries(participants)
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
        totalMessages,
        totalWords,
        wpm: speakingMinutes > 0 ? Number((totalWords / speakingMinutes).toFixed(2)) : 0,
        noiseMessagesCount: totalNoise,
        noiseRatio,
        noiseBreakdown: breakdown,
        backchannelCount,
        interruptionCount,
        mergedCuesCount: mergedCues.length,
        responseTimeCount: responseTimes.length,
        preview: {
            raw: rawTranscriptText,
            clean: cleanTranscriptText
        }
    };
}

export { parseVTT, calculateDuration };
