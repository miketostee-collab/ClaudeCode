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

/** A round axis maximum and evenly spaced ticks (0 included) covering `max`. */
export function niceScale(max: number, ticks = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const rough = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return { max: top, ticks: out };
}

/**
 * A whole-number scale with exactly `intervals` steps covering `max`, so a second axis
 * (reps) lines up with the first axis's gridlines.
 */
export function alignedIntScale(max: number, intervals: number): { max: number; ticks: number[] } {
  const step = Math.max(1, Math.ceil(Math.max(0, max) / intervals));
  return { max: step * intervals, ticks: Array.from({ length: intervals + 1 }, (_, i) => i * step) };
}

/** "12 Nov" for an axis label. */
export function shortDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
