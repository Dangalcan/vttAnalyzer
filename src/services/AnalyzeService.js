import { parseVTT } from './vttParser.js';

/**
 * Service to handle VTT analysis business logic.
 */
export const AnalyzeService = {
    /**
     * Conducts analysis on the provided VTT file content.
     * @param {string} content - The string content of the VTT file.
     * @param {object} options - Analysis options (e.g. { filterNoise: true }).
     * @returns {object} The analysis results.
     */
    analyzeContent: (content, options = { filterNoise: true }) => {
        if (!content) {
            throw new Error('No content provided for analysis');
        }
        return parseVTT(content, options);
    }
};
