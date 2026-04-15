import { describe, it, expect } from 'vitest';
import { parseVTT, calculateDuration } from '../vttParser.js';

describe('VTT Parser', () => {
  const sampleVtt = `WEBVTT

5893c03c-0e4d-4e92-92a2-65899b901e6a/7-0
00:00:03.186 --> 00:00:08.612
<v PEDRO D&#205;AZ PEDREZ>Perfecto,
pues coménteme qué necesita o sobre qué</v>

5893c03c-0e4d-4e92-92a2-65899b901e6a/5-0
00:00:03.506 --> 00:00:04.226
<v DANIEL N&#218;&#209;EZ DANIELEZ>Muy bien.</v>
`;

  it('should parse basic VTT and extract participants', () => {
    const stats = parseVTT(sampleVtt);
    
    expect(stats.participantCount).toBe(2);
    expect(stats.totalMessages).toBe(2);
    
    const emilio = stats.participants.find(p => p.name === 'PEDRO DÍAZ PEDREZ');
    const gonzalo = stats.participants.find(p => p.name === 'DANIEL NÚÑEZ DANIELEZ');
    
    expect(emilio).toBeDefined();
    expect(emilio.count).toBe(1);
    expect(gonzalo).toBeDefined();
    expect(gonzalo.count).toBe(1);
  });

  it('should calculate duration correctly', () => {
    const stats = parseVTT(sampleVtt);
    // last timestamp 00:00:08.612, first 00:00:03.186
    expect(stats.durationSeconds).toBe(5.426);
    expect(stats.durationMinutes).toBe(0.09);
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
