import he from 'he';

/**
 * Parses a HH:MM:SS.mmm timestamp to total seconds.
 */
function parseTimestampToSeconds(ts) {
    if (!ts) return 0;
    const [hms, ms] = ts.split('.');
    if (!hms || !ms) return 0;
    const parts = hms.split(':').map(Number);
    if (parts.length !== 3) return 0;
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

/**
 * Calculates duration in seconds between two HH:MM:SS.mmm timestamps.
 */
function calculateDuration(start, end) {
    if (!start || !end) return 0;
    return Number((parseTimestampToSeconds(end) - parseTimestampToSeconds(start)).toFixed(3));
}

/**
 * Parses VTT content and extracts statistics.
 * @param {string} content 
 * @returns {object}
 */
function parseVTT(content) {
    const lines = content.split(/\r?\n/);
    let participants = {};
    let firstTimestamp = null;
    let lastTimestamp = null;
    let totalMessages = 0;

    let previousSpeaker = null;
    let previousSpeakerEnd = 0;
    let responseTimes = [];

    // Regex for timestamps: 00:00:03.186 --> 00:00:08.612
    const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
    // Regex for voice tags: <v EMILIO D&#205;AZ ARCENEGUI>
    const voiceRegex = /<v ([^>]+)>/;

    let currentParticipant = null;
    let currentCueStartSeconds = 0;
    let currentCueEndSeconds = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Extract timestamps
        const tsMatch = line.match(timestampRegex);
        if (tsMatch) {
            const start = tsMatch[1];
            const end = tsMatch[2];
            
            if (!firstTimestamp) firstTimestamp = start;
            
            // Track the maximum end timestamp
            if (!lastTimestamp || calculateDuration(firstTimestamp, end) > calculateDuration(firstTimestamp, lastTimestamp)) {
                lastTimestamp = end;
            }
            
            currentCueStartSeconds = parseTimestampToSeconds(start);
            currentCueEndSeconds = parseTimestampToSeconds(end);
            
            continue;
        }

        // Extract participant
        const vMatch = line.match(voiceRegex);
        if (vMatch) {
            let name = he.decode(vMatch[1]);
            currentParticipant = name;
            
            if (!participants[name]) {
                participants[name] = 0;
            }
            participants[name]++;
            totalMessages++;

            if (previousSpeaker === null) {
                previousSpeaker = name;
                previousSpeakerEnd = currentCueEndSeconds;
            } else if (previousSpeaker === name) {
                previousSpeakerEnd = Math.max(previousSpeakerEnd, currentCueEndSeconds);
            } else {
                const gap = currentCueStartSeconds - previousSpeakerEnd;
                responseTimes.push(gap);
                previousSpeaker = name;
                previousSpeakerEnd = currentCueEndSeconds;
            }
        }
    }

    const durationSeconds = calculateDuration(firstTimestamp, lastTimestamp);
    const durationMinutes = Number((durationSeconds / 60).toFixed(2));
    
    let sumResponseTimes = responseTimes.reduce((acc, curr) => acc + curr, 0);
    let meanResponseTimeSeconds = responseTimes.length > 0 ? Number((sumResponseTimes / responseTimes.length).toFixed(2)) : 0;

    return {
        durationSeconds,
        durationMinutes,
        meanResponseTimeSeconds,
        participantCount: Object.keys(participants).length,
        participants: Object.entries(participants).map(([name, count]) => ({ name, count })),
        totalMessages
    };
}

export { parseVTT, calculateDuration };
