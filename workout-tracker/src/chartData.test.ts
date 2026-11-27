import { describe, expect, it } from 'vitest';
import { alignedIntRange, chartPoints, niceRange } from './chartData';
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

describe('niceRange', () => {
  it('starts the axis just below the data', () => {
    expect(niceRange(60, 87.5)).toEqual({ min: 50, max: 90, ticks: [50, 60, 70, 80, 90] });
    expect(niceRange(100, 102.5).min).toBeGreaterThan(90);
    expect(niceRange(60, 60)).toEqual({ min: 55, max: 60, ticks: [55, 60] });
  });

  it('never goes below zero', () => {
    expect(niceRange(2, 40).min).toBe(0);
    expect(niceRange(0, 0)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });
});

describe('alignedIntRange', () => {
  it('uses whole steps with the same number of intervals, below the smallest value', () => {
    expect(alignedIntRange(7, 10, 4)).toEqual({ min: 6, max: 10, ticks: [6, 7, 8, 9, 10] });
    expect(alignedIntRange(3, 12, 4)).toEqual({ min: 0, max: 12, ticks: [0, 3, 6, 9, 12] });
    expect(alignedIntRange(5, 5, 1)).toEqual({ min: 4, max: 5, ticks: [4, 5] });
  });
});
