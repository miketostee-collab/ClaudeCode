import { describe, expect, it } from 'vitest';
import { convertWeight, fmtNum, relativeDay, summarizeSets } from './prefs';

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
