import type { Entry, Unit } from './db';
import { convertWeight } from './prefs';

export interface ChartPoint {
  date: string;
  weight: number;
  reps: number;
}

/**
 * One bar pair per day for the History chart, oldest first: each day's heaviest max set
 * (most reps on a tie), with weights converted to `unit`. Keeps the most recent `limit` days.
 */
export function chartPoints(entries: Entry[], unit: Unit, limit = 12): ChartPoint[] {
  const byDay = new Map<string, ChartPoint>();
  for (const e of entries) {
    const p = { date: e.date, weight: convertWeight(e.weight, e.unit, unit), reps: e.reps };
    const best = byDay.get(e.date);
    if (!best || p.weight > best.weight || (p.weight === best.weight && p.reps > best.reps)) byDay.set(e.date, p);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-limit);
}

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * A tidy axis range around the data, so changes stand out instead of every bar
 * starting at zero. The minimum sits one round step below the smallest value (never
 * below 0), so the shortest bar is still visible.
 */
export function niceRange(min: number, max: number, target = 4): Scale {
  let span = max - min;
  if (!(span > 0)) span = max > 0 ? max * 0.2 : 4;
  const rough = span / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  let lo = Math.floor(min / step) * step;
  if (lo >= min) lo -= step;
  lo = Math.max(0, lo);
  let hi = Math.ceil(max / step) * step;
  if (hi <= lo) hi = lo + step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min: lo, max: hi, ticks };
}

/**
 * A whole-number range with exactly `intervals` steps covering min..max, so a second
 * axis (reps) lines up with the first axis's gridlines. Starts below the smallest value.
 */
export function alignedIntRange(min: number, max: number, intervals: number): Scale {
  for (let step = 1; ; step++) {
    let lo = Math.floor(min / step) * step;
    if (lo >= min) lo -= step;
    lo = Math.max(0, lo);
    if (lo + step * intervals >= max) {
      return { min: lo, max: lo + step * intervals, ticks: Array.from({ length: intervals + 1 }, (_, i) => lo + i * step) };
    }
  }
}

/** "12 Nov" for an axis label. */
export function shortDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
