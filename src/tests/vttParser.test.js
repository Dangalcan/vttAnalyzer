import { describe, it, expect } from 'vitest';
import { parseVTT, calculateDuration } from '../services/vttParser.js';

describe('VTT Parser', () => {
  const sampleVtt = `WEBVTT

5893c03c-0e4d-4e92-92a2-65899b901e6a/7-0
00:00:03.186 --> 00:00:08.612
<v PEDRO DÍAZ PEDREZ>Perfecto,
pues coménteme qué necesita o sobre qué</v>

5893c03c-0e4d-4e92-92a2-65899b901e6a/5-0
00:00:03.506 --> 00:00:04.226
<v DANIEL NÚÑEZ DANIELEZ>Muy bien.</v>
`;

  it('should parse basic VTT and extract participants with normalization', () => {
    const stats = parseVTT(sampleVtt);
    
    expect(stats.participantCount).toBe(2);
    expect(stats.totalMessages).toBe(2);
    
    // Names are now normalized: PEDRO DÍA... -> PEDRO DIA...
    const pedro = stats.participants.find(p => p.name === 'PEDRO DIAZ PEDREZ');
    const daniel = stats.participants.find(p => p.name === 'DANIEL NUNEZ DANIELEZ');
    
    expect(pedro).toBeDefined();
    expect(pedro.count).toBe(1);
    expect(daniel).toBeDefined();
    expect(daniel.count).toBe(1);
  });

  it('should calculate duration correctly', () => {
    const stats = parseVTT(sampleVtt);
    // last timestamp 00:00:08.612, first 00:00:03.186
    expect(stats.durationSeconds).toBe(5.426);
    expect(stats.durationMinutes).toBe(0.09);
  });

  it('should calculate mean response time correctly', () => {
    const meanTimeVtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
<v User 1>Hello</v>

2
00:00:05.000 --> 00:00:11.000
<v User 2>Hi there</v>

3
00:00:14.000 --> 00:00:16.000
<v User 2>Are you there?</v>

4
00:00:17.000 --> 00:00:27.000
<v User 1>Yes I am here</v>
`;
    const stats = parseVTT(meanTimeVtt);
    expect(stats.durationSeconds).toBe(27);
    expect(stats.meanResponseTimeSeconds).toBe(1.5);
  });

  it('should filter out noise and handle overlapping gaps', () => {
    const noiseVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Hello, this is a long message</v>

2
00:00:08.000 --> 00:00:12.000
<v User 2>Vale</v>

3
00:00:14.000 --> 00:00:16.000
<v User 2>This is a real message after filler</v>

4
00:00:15.000 --> 00:00:18.000
<v User 1>Overlap interruption</v>

5
00:00:20.000 --> 00:00:22.000
<v User 2>S</v>

6
00:00:25.000 --> 00:00:30.000
<v User 1>Final message</v>
`;
    const stats = parseVTT(noiseVtt);
    
    // User 2' "Vale" (filler) and "S" (too short) should be filtered out.
    // Remaining cues:
    // 1: User 1 (0-10) "Hello..."
    // 3: User 2 (14-16) "This is..."
    // 4: User 1 (15-18) "Overlap..."
    // 6: User 1 (25-30) "Final..."
    
    expect(stats.totalMessages).toBe(4);
    
    // Gaps:
    // Cue 1 (0-10) -> Cue 3 (14-16): User 1 to User 2. Gap = 14 - 10 = 4.
    // Cue 3 (14-16) -> Cue 4 (15-18): User 2 to User 1. Gap = 15 - 16 = -1 -> should be 0.
    // Cue 4 (15-18) -> Cue 6 (25-30): Same speaker (User 1), ignored.
    
    // Response times: [4, 0]
    expect(stats.meanResponseTimeSeconds).toBe(2);
  });

  it('should handle multi-line cues and combine text', () => {
    const multiLineVtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
<v User 1>Line one
Line two
Line three</v>

2
00:00:06.000 --> 00:00:10.000
<v User 2>Response</v>
`;
    const stats = parseVTT(multiLineVtt);
    expect(stats.totalMessages).toBe(2);
  });

  it('should handle scientific noise (logistics, short duration, fillers)', () => {
    const scientificVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Hello, let's start the meeting</v>

2
00:00:11.000 --> 00:00:11.500
<v User 2>Short</v>

3
00:00:12.000 --> 00:00:15.000
<v User 2>¿Me escuchas bien?</v>

4
00:00:16.000 --> 00:00:20.000
<v User 1>Yes, I can hear you perfectly</v>

5
00:00:21.000 --> 00:00:22.000
<v User 2>Entonces</v>
`;
    const stats = parseVTT(scientificVtt);
    
    // 1: User 1 (0-10) - CLEAN
    // 2: User 2 (11-11.5) - NOISE (duration 0.5 < 0.7)
    // 3: User 2 (12-15) - NOISE (logistics "escuchas")
    // 4: User 1 (16-20) - CLEAN
    // 5: User 2 (21-22) - NOISE (filler "entonces")
    
    expect(stats.totalMessages).toBe(2);
    expect(stats.noiseMessagesCount).toBe(3);
    // 3 noise / 5 total cues = 60%
    expect(stats.noiseRatio).toBe(60);
  });

  it('should return raw statistics when noise filtering is disabled', () => {
    const rawVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Vale</v>

2
00:00:11.000 --> 00:00:12.000
<v User 2>¿Me escuchas?</v>
`;
    // Pass filterNoise: false
    const stats = parseVTT(rawVtt, { filterNoise: false });
    
    // Both cues should be kept
    expect(stats.totalMessages).toBe(2);
    expect(stats.noiseMessagesCount).toBe(0);
    expect(stats.noiseRatio).toBe(0);
  });

  it('should throw on missing WEBVTT header', () => {
    expect(() => parseVTT('This is not a VTT file')).toThrow('Invalid VTT format');
    expect(() => parseVTT('')).toThrow('Invalid VTT format');
  });

  it('should expose mergedCuesCount and responseTimeCount in output', () => {
    const stats = parseVTT(sampleVtt);
    expect(typeof stats.mergedCuesCount).toBe('number');
    expect(stats.mergedCuesCount).toBeGreaterThanOrEqual(stats.totalMessages);
    expect(typeof stats.responseTimeCount).toBe('number');
    expect(stats.responseTimeCount).toBeGreaterThanOrEqual(0);
  });

  it('should include speakingSeconds per participant', () => {
    const stats = parseVTT(sampleVtt);
    stats.participants.forEach(p => {
      expect(typeof p.speakingSeconds).toBe('number');
      expect(p.speakingSeconds).toBeGreaterThan(0);
    });
  });

  it('should detect new fillers (huh, nah, venga, ya ya) as backchannels', () => {
    const fillerVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Let me explain the architecture in detail here.</v>

2
00:00:03.000 --> 00:00:04.000
<v User 2>huh</v>

3
00:00:05.000 --> 00:00:06.000
<v User 2>nah</v>

4
00:00:07.000 --> 00:00:08.000
<v User 2>venga</v>

5
00:00:09.000 --> 00:00:10.000
<v User 2>ya ya</v>

6
00:00:11.000 --> 00:00:20.000
<v User 1>So that is the full picture of the system design.</v>
`;
    const stats = parseVTT(fillerVtt);
    // The 4 filler cues are backchannels, only 2 semantic turns remain
    expect(stats.backchannelCount).toBe(4);
    expect(stats.totalMessages).toBe(2);
  });

  it('should NOT filter logistics phrase when it is a substring of a longer word', () => {
    const boundaryVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>I want to share screened candidates with the team today.</v>

2
00:00:11.000 --> 00:00:20.000
<v User 2>That sounds great, let us review the shortlist.</v>
`;
    const stats = parseVTT(boundaryVtt, { filterNoise: true });
    // "share screen" is NOT a whole-word match inside "share screened" — both turns kept
    expect(stats.totalMessages).toBe(2);
    expect(stats.noiseMessagesCount).toBe(0);
  });

  it('should filter logistics phrase when it is an exact whole-word match', () => {
    const logisticsVtt = `WEBVTT

1
00:00:00.000 --> 00:00:10.000
<v User 1>Can you share screen please?</v>

2
00:00:11.000 --> 00:00:20.000
<v User 2>Let me get that up for you now.</v>
`;
    const stats = parseVTT(logisticsVtt, { filterNoise: true });
    // "share screen" is a whole-word match — first cue filtered
    expect(stats.totalMessages).toBe(1);
    expect(stats.noiseMessagesCount).toBe(1);
  });

  describe('calculateDuration', () => {
    it('should calculate duration between two timestamps', () => {
        expect(calculateDuration('00:00:03.186', '00:00:08.612')).toBe(5.426);
    });

    it('should handle same timestamps', () => {
        expect(calculateDuration('00:00:01.000', '00:00:01.000')).toBe(0);
    });

    it('should handle zero timestamps', () => {
        expect(calculateDuration(null, null)).toBe(0);
    });
  });
});
