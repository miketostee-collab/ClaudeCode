import { describe, expect, it } from 'vitest';
import { alignedIntScale, chartPoints, niceScale } from './chartData';
import type { Entry } from './db';

const e = (date: string, weight: number, reps: number, unit: 'kg' | 'lb' = 'kg'): Entry =>
  ({ id: date + weight + reps, exerciseId: 'x', date, timestamp: 0, unit, weight, reps, updatedAt: 0, dirty: 0 }) as Entry;

describe('chartPoints', () => {
  it('keeps the heaviest set per day, oldest first, in the display unit', () => {
    const pts = chartPoints([e('2026-11-20', 80, 5), e('2026-11-18', 70, 8), e('2026-11-20', 85, 3), e('2026-11-19', 220.5, 6, 'lb')], 'kg');
    expect(pts).toEqual([
      { date: '2026-11-18', weight: 70, reps: 8 },
      { date: '2026-11-19', weight: 100, reps: 6 },
      { date: '2026-11-20', weight: 85, reps: 3 },
    ]);
  });

  it('breaks a weight tie on reps and keeps only the latest days', () => {
    expect(chartPoints([e('2026-11-20', 80, 5), e('2026-11-20', 80, 7)], 'kg')).toEqual([{ date: '2026-11-20', weight: 80, reps: 7 }]);
    const many = Array.from({ length: 20 }, (_, i) => e(`2026-11-${String(i + 1).padStart(2, '0')}`, 50 + i, 5));
    const pts = chartPoints(many, 'kg', 12);
    expect(pts).toHaveLength(12);
    expect(pts[0].date).toBe('2026-11-09');
    expect(pts[11].date).toBe('2026-11-20');
  });
});

describe('niceScale', () => {
  it('rounds the axis up to tidy steps', () => {
    expect(niceScale(87)).toEqual({ max: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(12)).toEqual({ max: 15, ticks: [0, 5, 10, 15] });
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
  });
});

describe('alignedIntScale', () => {
  it('uses whole steps with the same number of intervals', () => {
    expect(alignedIntScale(10, 4)).toEqual({ max: 12, ticks: [0, 3, 6, 9, 12] });
    expect(alignedIntScale(3, 4)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
  });
});
