import type { Observation, Project } from './db';
import { formatStrikeDip } from './geo';

/** A short label for a pin or waypoint. */
export function observationName(o: Observation): string {
  const parts = [o.sampleId, o.rockType].filter(Boolean);
  const label = o.type.charAt(0).toUpperCase() + o.type.slice(1);
  return parts.length ? `${label}: ${parts.join(' · ')}` : label;
}

function projectName(o: Observation, projects: Project[]) {
  return projects.find((p) => p.id === o.projectId)?.name;
}

/** GeoJSON FeatureCollection of points. Coordinates are [lng, lat(, altitude)] as the format requires. */
export function toGeoJSON(observations: Observation[], projects: Project[]) {
  return {
    type: 'FeatureCollection' as const,
    features: observations.map((o) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: o.altitude != null ? [o.lng, o.lat, o.altitude] : [o.lng, o.lat],
      },
      properties: {
        id: o.id,
        name: observationName(o),
        project: projectName(o, projects) ?? null,
        type: o.type,
        recorded_at: new Date(o.recordedAt).toISOString(),
        accuracy_m: o.accuracy ?? null,
        rock_type: o.rockType ?? null,
        formation: o.formation ?? null,
        description: o.description ?? null,
        sample_id: o.sampleId ?? null,
        strike: o.strike ?? null,
        dip: o.dip ?? null,
        dip_direction: o.dipDirection ?? null,
        notes: o.notes ?? null,
      },
    })),
  };
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** GPX 1.1 waypoints, readable by most mapping and GIS apps. */
export function toGPX(observations: Observation[], projects: Project[]): string {
  const wpts = observations
    .map((o) => {
      const lines = [
        o.description,
        formatStrikeDip(o) && `Strike/dip: ${formatStrikeDip(o)}`,
        o.formation && `Formation: ${o.formation}`,
        o.notes,
        projectName(o, projects) && `Project: ${projectName(o, projects)}`,
      ].filter(Boolean);
      return [
        `  <wpt lat="${o.lat}" lon="${o.lng}">`,
        o.altitude != null ? `    <ele>${o.altitude}</ele>` : '',
        `    <time>${new Date(o.recordedAt).toISOString()}</time>`,
        `    <name>${xml(observationName(o))}</name>`,
        lines.length ? `    <desc>${xml(lines.join('\n'))}</desc>` : '',
        `    <type>${xml(o.type)}</type>`,
        '  </wpt>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Geo Tracker" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>\n`;
}

const CSV_COLUMNS = [
  'recorded_at',
  'project',
  'type',
  'latitude',
  'longitude',
  'altitude_m',
  'accuracy_m',
  'rock_type',
  'formation',
  'description',
  'sample_id',
  'strike',
  'dip',
  'dip_direction',
  'notes',
] as const;

/** One CSV cell. Quotes when needed, and defuses text a spreadsheet would run as a formula. */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(observations: Observation[], projects: Project[]): string {
  const rows = observations.map((o) =>
    [
      new Date(o.recordedAt).toISOString(),
      projectName(o, projects),
      o.type,
      o.lat,
      o.lng,
      o.altitude,
      o.accuracy,
      o.rockType,
      o.formation,
      o.description,
      o.sampleId,
      o.strike,
      o.dip,
      o.dipDirection,
      o.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** Saves text as a file download. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
