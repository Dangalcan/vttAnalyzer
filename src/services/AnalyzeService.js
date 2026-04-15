import { parseVTT } from './vttParser.js';

/**
 * Service to handle VTT analysis business logic.
 */
export const AnalyzeService = {
    /**
     * Conducts analysis on the provided VTT file content.
     * @param {string} content - The string content of the VTT file.
     * @returns {object} The analysis results.
     */
    analyzeContent: (content) => {
        if (!content) {
            throw new Error('No content provided for analysis');
        }
        return parseVTT(content);
    }
};
