import { useEffect, useState } from 'react';
import type { Unit } from './db';

// Small per-device conveniences. Wrapped in try/catch because storage can be unavailable
// (e.g. private browsing); the app still works, it just won't remember these.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => (read(key) as T | null) ?? fallback);
  useEffect(() => write(key, value), [key, value]);
  return [value, setValue];
}

// kg is the default. The key changed from 'unit' when the default moved from lb to kg,
// so devices that saved the old default start on kg; the Settings toggle still works.
export const useUnit = () => usePref<Unit>('unit-v2', 'kg');

export function useSelectedExercise(): [string | null, (id: string | null) => void] {
  const [raw, setRaw] = usePref<string>('selectedExercise', '');
  return [raw || null, (v) => setRaw(v ?? '')];
}

const LB_PER_KG = 2.20462;

/** Converts a weight between units, rounded to the nearest 0.5. */
export function convertWeight(weight: number, from: Unit, to: Unit): number {
  if (from === to) return weight;
  const raw = from === 'kg' ? weight * LB_PER_KG : weight / LB_PER_KG;
  return Math.round(raw * 2) / 2;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function relativeDay(date: string, today: string): string {
  if (date === today) return 'Today';
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(date);
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** Short one-line summary, e.g. "3 × 8 @ 80 kg" or "80×10, 85×8, 90×6 kg". */
/** "100 kg × 5" */
export function formatMaxSet(e: { weight: number; reps: number; unit: Unit }): string {
  return `${fmtNum(e.weight)} ${e.unit} × ${e.reps}`;
}

/** "just now", "5 min ago", "3 h ago", or a date. */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The time an entry was saved, or '' for one added for a past day (stamped at exactly midday). */
export function entryTime(timestamp: number): string {
  const d = new Date(timestamp);
  if (d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
