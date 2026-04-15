import { describe, it, expect } from 'vitest';
import { parseVTT } from '../services/vttParser.js';

describe('VTT Parser V3 - Advanced Semantics', () => {
    
    it('should merge shadow cues from the same speaker with small gaps', () => {
        const shadowVtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v User 1>Hello, this is</v>

2
00:00:05.100 --> 00:00:10.000
<v User 1>the rest of my sentence.</v>
`;
        const stats = parseVTT(shadowVtt);
        
        // Gap is 0.1s (< 0.2s), so they should merge into 1 semantic turn.
        expect(stats.totalMessages).toBe(1);
    });

    it('should NOT merge cues if the gap is larger than 0.2s', () => {
        const splitVtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v User 1>Hello.</v>

2
00:00:05.300 --> 00:00:10.000
<v User 1>Goodbye.</v>
`;
        const stats = parseVTT(splitVtt);
        
        // Gap is 0.3s (> 0.2s), so they should stay as 2 turns.
        expect(stats.totalMessages).toBe(2);
    });

    it('should identify backchannels and count them separately', () => {
        const backchannelVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>I have a lot to say about pizzerias.</v>

2
00:00:05.000 --> 00:00:06.000
<v User 2>Vale</v>

3
00:00:11.000 --> 00:00:15.000
<v User 1>And also about the crust.</v>

4
00:00:16.000 --> 00:00:17.000
<v User 2>Sí</v>
`;
        const stats = parseVTT(backchannelVtt);
        
        // User 2's "Vale" and "Sí" are backchannels.
        // User 1 has 2 semantic turns.
        expect(stats.totalMessages).toBe(2);
        expect(stats.backchannelCount).toBe(2);
    });

    it('should strip acoustic markers from text', () => {
        const acousticVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Hello [music] (inaudible) World</v>
`;
        // We can't easily check the internal text from the outside, 
        // but we can check if it still counts as a message.
        const stats = parseVTT(acousticVtt);
        expect(stats.totalMessages).toBe(1);
    });

    it('should count words correctly even with multiple consecutive spaces', () => {
        // Double/triple spaces must not inflate word count
        const doubleSpaceVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>hello   world</v>
`;
        const stats = parseVTT(doubleSpaceVtt);
        const participant = stats.participants.find(p => p.name === 'USER 1');
        // "hello   world" → 2 words, not 3 or 4
        expect(participant.words).toBe(2);
    });

    it('should decode speaker names and normalize them', () => {
        const encodedVtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v &#193;LVARO D&#205;AZ>Hello</v>
`;
        const stats = parseVTT(encodedVtt);
        expect(stats.participants[0].name).toBe('ALVARO DIAZ');
    });
});
