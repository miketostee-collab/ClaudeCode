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

export const useUnit = () => usePref<Unit>('unit', 'lb');

export function useSelectedExercise(): [number | null, (id: number | null) => void] {
  const [raw, setRaw] = usePref<string>('selectedExercise', '');
  const id = raw ? Number(raw) : null;
  return [id, (v) => setRaw(v == null ? '' : String(v))];
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
