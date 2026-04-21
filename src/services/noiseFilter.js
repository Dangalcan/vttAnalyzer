/**
 * Noise filtering pipeline for VTT conversation analysis.
 *
 * Constants are defined at module level (not inside the filter function) so
 * they are allocated once regardless of how many files are processed.
 *
 * All thresholds are configurable via the options object so callers can tune
 * sensitivity without touching core logic.
 */

const FILLERS = new Set([
    // Spanish back-channels and agreements
    'sí', 'si', 'no', 'vale', 'okay', 'ok', 'claro', 'bueno', 'va', 'pues',
    'entonces', 'eso es', 'ajá', 'aja', 'mhm', 'exacto', 'totalmente', 'nop',
    'venga', 'oye', 'anda', 'mira', 'uy', 'ay', 'dale', 'ya', 'ya ya',
    'claro que sí', 'por supuesto', 'sí sí',
    // English back-channels and agreements
    'yeah', 'yes', 'yup', 'yep', 'right', 'sure', 'fine', 'cool', 'good',
    'huh', 'nah', 'nope', 'oh', 'well', 'uh-huh', 'uhuh', 'mmhmm', 'mm-hm',
    'ok ok',
    // Phonetic / acoustic fillers
    'uh', 'um', 'er', 'hmm', 'hm', 'ah', 'eh', 'mm', 'mmm',
    'eeh', 'eehh', 'aah', 'aaah', 'hmhm',
]);

// Phrase-based logistics detection — specific enough to avoid flagging
// legitimate content words like "share" or "internet" in isolation.
// Single ambiguous words ("zoom", "teams") are intentionally excluded;
// only multi-word phrases with clear logistics intent are listed here.
const LOGISTICS_PHRASES = [
    // Spanish
    'escuchas', 'escucho', 'la pantalla', 'compartir pantalla',
    'un segundo', 'un momento',
    // English technical checks
    'hear me', 'can you hear', 'can you see',
    'share screen', 'share my screen',
    'no audio', 'audio problem', 'audio issue',
    'no connection', 'bad connection', 'internet connection',
    'mic problem', 'mic off', 'mic muted', 'unmute your mic',
    'microphone issue', 'microphone off',
    // Platform references in logistics context (multi-word only)
    'zoom call', 'zoom link', 'join zoom', 'on zoom', 'using zoom', 'en zoom', 'por zoom',
    'teams call', 'join teams', 'on teams', 'using teams', 'en teams', 'por teams',
];

/**
 * Returns true when `text` contains `phrase` as whole words (not as a
 * substring of a longer word).  For example "share screen" matches
 * "share screen now" but NOT "share screened calls".
 *
 * @param {string} text   - Already lower-cased, punctuation-stripped cue text.
 * @param {string} phrase - Lower-cased logistics phrase to search for.
 * @returns {boolean}
 */
function matchesLogisticsPhrase(text, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)').test(text);
}

/** Default thresholds — exported so callers and tests can reference them. */
export const NOISE_DEFAULTS = {
    /** Utterances shorter than this (seconds) are classified as durational noise. */
    durationThreshold: 0.7,
    /** Same-speaker gaps smaller than this (seconds) trigger shadow-cue merging. */
    mergeGapThreshold: 0.2,
    /** Logistics phrases in a cue with fewer than this many words are filtered. */
    logisticsWordLimit: 6,
    /** Alphanumeric character count below this is treated as a backchannel. */
    alnumMinLength: 3,
    /** Speaker-turn gaps larger than this (seconds) are excluded from response-time calc. */
    maxResponseGapSeconds: 30,
};

/**
 * Filters noise from a list of merged cues.
 *
 * Backchannel counting is always performed (it is an observation of the
 * conversation), regardless of whether filtering is enabled.  Filtering only
 * controls whether those cues are excluded from finalCues.
 *
 * @param {Array<{speaker:string, text:string, duration:number}>} mergedCues
 * @param {object}  [options]
 * @param {boolean} [options.filterNoise=true]
 * @param {number}  [options.durationThreshold]
 * @param {number}  [options.logisticsWordLimit]
 * @param {number}  [options.alnumMinLength]
 * @returns {{ finalCues: Array, breakdown: object, backchannelCount: number }}
 */
export function filterCues(mergedCues, options = {}) {
    const filterNoise      = options.filterNoise !== false;
    const durationThresh   = options.durationThreshold ?? NOISE_DEFAULTS.durationThreshold;
    const logisticsLimit   = options.logisticsWordLimit ?? NOISE_DEFAULTS.logisticsWordLimit;
    const alnumMin         = options.alnumMinLength    ?? NOISE_DEFAULTS.alnumMinLength;

    let noiseDurationCount  = 0;
    let noiseLogisticsCount = 0;
    let noiseBackchannelCount = 0;
    let noiseOtherCount     = 0;
    let backchannelCount    = 0;
    const finalCues         = [];

    for (const c of mergedCues) {
        // Structurally incomplete cues (no speaker or empty text)
        if (!c.speaker || !c.text.trim()) {
            if (filterNoise) {
                noiseOtherCount++;
            } else {
                finalCues.push({ ...c, speaker: c.speaker || 'Unknown' });
            }
            continue;
        }

        const lowerText  = c.text.toLowerCase().replace(/[.,!?;¿?¡!]/g, '').trim();
        const alnumText  = lowerText.replace(/[^a-z0-9]/g, '');

        // Backchannel detection is always an observation
        const isBackchannel = FILLERS.has(lowerText) || alnumText.length < alnumMin;
        if (isBackchannel) backchannelCount++;

        if (filterNoise) {
            // Priority 1: Backchannels (filler / short agreement)
            if (isBackchannel) {
                noiseBackchannelCount++;
                continue;
            }

            // Priority 2: Durational noise
            if (c.duration < durationThresh) {
                noiseDurationCount++;
                continue;
            }

            // Priority 3: Logistics talk (phrase-based, below word limit)
            // Uses word-boundary matching to avoid false positives from substrings
            // (e.g. "share screened calls" must not match "share screen").
            const hasLogistics = LOGISTICS_PHRASES.some(phrase => matchesLogisticsPhrase(lowerText, phrase));
            if (hasLogistics && lowerText.split(/\s+/).filter(Boolean).length < logisticsLimit) {
                noiseLogisticsCount++;
                continue;
            }
        }

        finalCues.push(c);
    }

    return {
        finalCues,
        breakdown: {
            duration:   noiseDurationCount,
            logistics:  noiseLogisticsCount,
            backchannel: noiseBackchannelCount,
            other:      noiseOtherCount,
        },
        backchannelCount,
    };
}
