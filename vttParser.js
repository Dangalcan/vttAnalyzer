const he = require('he');

/**
 * Calculates duration in seconds between two HH:MM:SS.mmm timestamps.
 */
function calculateDuration(start, end) {
    if (!start || !end) return 0;

    const parse = (ts) => {
        const [hms, ms] = ts.split('.');
        const [h, m, s] = hms.split(':').map(Number);
        return h * 3600 + m * 60 + s + Number(ms) / 1000;
    };

    return Number((parse(end) - parse(start)).toFixed(3));
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

    // Regex for timestamps: 00:00:03.186 --> 00:00:08.612
    const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
    // Regex for voice tags: <v EMILIO D&#205;AZ ARCENEGUI>
    const voiceRegex = /<v ([^>]+)>/;

    let currentParticipant = null;

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
        }
    }

    const durationSeconds = calculateDuration(firstTimestamp, lastTimestamp);
    const durationMinutes = Number((durationSeconds / 60).toFixed(2));

    return {
        durationSeconds,
        durationMinutes,
        participantCount: Object.keys(participants).length,
        participants: Object.entries(participants).map(([name, count]) => ({ name, count })),
        totalMessages
    };
}

module.exports = { parseVTT, calculateDuration };
