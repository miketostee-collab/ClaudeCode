import { useEffect, useRef, useState } from 'react';
import type { Observation } from './db';

/** A GPS reading. */
export interface Fix {
  lat: number;
  lng: number;
  /** Metres above sea level, when reported. */
  altitude?: number;
  /** Horizontal accuracy in metres (smaller is better). */
  accuracy: number;
  /** When the phone took the reading, ms since epoch. */
  at: number;
}

export type GpsStatus = 'searching' | 'ok' | 'denied' | 'unavailable';

export interface Gps {
  status: GpsStatus;
  /** The most accurate recent reading, or null until one arrives. */
  fix: Fix | null;
  error: string | null;
}

function toFix(p: GeolocationPosition): Fix {
  const { latitude, longitude, altitude, accuracy } = p.coords;
  return {
    lat: latitude,
    lng: longitude,
    accuracy,
    at: p.timestamp,
    ...(altitude != null && Number.isFinite(altitude) ? { altitude } : {}),
  };
}

/** Readings older than this are not kept as "best". */
const FRESH_MS = 20_000;

/**
 * Keeps the most accurate recent GPS fix while `active` is true. The GPS only runs while
 * the screen using this is open (it is switched off otherwise, to save battery).
 * `restart()` throws away the current fix and starts looking again.
 */
export function useGps(active: boolean): Gps & { restart: () => void } {
  const [state, setState] = useState<Gps>({ status: 'searching', fix: null, error: null });
  const [run, setRun] = useState(0);
  const best = useRef<Fix | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', fix: null, error: 'This device has no GPS access in the browser.' });
      return;
    }
    best.current = null;
    setState({ status: 'searching', fix: null, error: null });
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = toFix(p);
        const cur = best.current;
        // Keep the better reading unless it has gone stale.
        if (!cur || next.accuracy <= cur.accuracy || next.at - cur.at > FRESH_MS) best.current = next;
        setState({ status: 'ok', fix: best.current, error: null });
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setState({
            status: 'denied',
            fix: null,
            error: 'Location permission is off. Allow it for this app in iPhone Settings > Privacy > Location Services.',
          });
        } else {
          // Keep any earlier fix; the GPS may just be briefly blocked.
          setState((s) => ({ status: s.fix ? 'ok' : 'searching', fix: s.fix, error: e.message || 'Waiting for a GPS signal…' }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, run]);

  return { ...state, restart: () => setRun((n) => n + 1) };
}

export type AccuracyLevel = 'good' | 'fair' | 'poor';

export function accuracyLevel(metres: number): AccuracyLevel {
  if (metres <= 10) return 'good';
  if (metres <= 30) return 'fair';
  return 'poor';
}

export function formatCoords(lat: number, lng: number, digits = 5): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lng).toFixed(digits)}° ${ew}`;
}

export function formatAccuracy(metres: number): string {
  return `±${metres < 10 ? metres.toFixed(1).replace(/\.0$/, '') : Math.round(metres)} m`;
}

const pad3 = (n: number) => String(Math.round(n) % 360).padStart(3, '0');

/** "045/30 SE" (strike/dip and dip direction), or '' when neither is set. */
export function formatStrikeDip(o: Pick<Observation, 'strike' | 'dip' | 'dipDirection'>): string {
  if (o.strike == null && o.dip == null) return '';
  const strike = o.strike != null ? pad3(o.strike) : '—';
  const dip = o.dip != null ? String(Math.round(o.dip)).padStart(2, '0') : '—';
  return `${strike}/${dip}${o.dipDirection ? ` ${o.dipDirection}` : ''}`;
}

/** The compass direction 90° clockwise of the strike (right-hand rule), as a suggestion. */
export function suggestDipDirection(strike: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const az = (((strike + 90) % 360) + 360) % 360;
  return dirs[Math.round(az / 45) % 8];
}
