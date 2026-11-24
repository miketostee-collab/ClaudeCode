import { describe, expect, it } from 'vitest';
import { convertWeight, fmtNum, relativeDay, relativeTime, summarizeSets } from './prefs';

describe('helpers', () => {
  it('converts weights to the nearest 0.5', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBe(220.5);
    expect(convertWeight(225, 'lb', 'kg')).toBe(102);
    expect(convertWeight(80, 'lb', 'lb')).toBe(80);
  });

  it('describes days relative to today', () => {
    expect(relativeDay('2026-11-24', '2026-11-24')).toBe('Today');
    expect(relativeDay('2026-11-23', '2026-11-24')).toBe('Yesterday');
    expect(relativeDay('2026-11-20', '2026-11-24')).toBe('4 days ago');
  });

  it('summarizes sets', () => {
    expect(summarizeSets([{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }], 'kg')).toBe('3 × 8 @ 80 kg');
    expect(summarizeSets([{ weight: 80, reps: 10 }, { weight: 85, reps: 8 }, { weight: 90.5, reps: 6 }], 'kg')).toBe('80×10, 85×8, 90.5×6 kg');
  });

  it('formats numbers without trailing zeros', () => {
    expect(fmtNum(185)).toBe('185');
    expect(fmtNum(102.5)).toBe('102.5');
  });
});

describe('relativeTime', () => {
  it('describes how long ago', () => {
    const now = Date.parse('2026-11-24T12:00:00');
    expect(relativeTime(now - 10_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(relativeTime(now - 3 * 3600_000, now)).toBe('3 h ago');
  });
});
