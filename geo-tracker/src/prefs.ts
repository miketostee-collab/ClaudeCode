import { useEffect, useState } from 'react';

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

/** The project new observations go into ('' for none). */
export const useCurrentProject = () => usePref<string>('currentProject', '');

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

/** "Mon 3 Nov, 2:15 PM" */
export function formatWhen(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** "just now", "5 min ago", "3 h ago", or a date. */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
