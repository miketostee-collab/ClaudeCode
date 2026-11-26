import { describe, expect, it } from 'vitest';
import type { Observation, Project } from './db';
import { csvCell, observationName, toCSV, toGPX, toGeoJSON } from './export';
import { accuracyLevel, formatAccuracy, formatCoords, formatStrikeDip, suggestDipDirection } from './geo';

const project: Project = { id: 'p1', name: 'Iceland', createdAt: 1 };
const obs = (over: Partial<Observation> = {}): Observation => ({
  id: 'o1',
  projectId: 'p1',
  lat: 64.1466,
  lng: -21.9426,
  altitude: 12,
  accuracy: 4,
  recordedAt: Date.UTC(2026, 5, 3, 14, 30),
  date: '2026-06-03',
  type: 'structure',
  rockType: 'basalt',
  sampleId: 'S-7',
  strike: 45,
  dip: 30,
  dipDirection: 'SE',
  notes: 'fresh, "clean" face',
  ...over,
});

describe('export', () => {
  it('GeoJSON puts longitude before latitude', () => {
    const g = toGeoJSON([obs()], [project]);
    expect(g.features[0].geometry.coordinates).toEqual([-21.9426, 64.1466, 12]);
    expect(g.features[0].properties).toMatchObject({ project: 'Iceland', type: 'structure', strike: 45, dip_direction: 'SE', recorded_at: '2026-06-03T14:30:00.000Z' });
    expect(toGeoJSON([obs({ altitude: undefined })], []).features[0].geometry.coordinates).toEqual([-21.9426, 64.1466]);
  });

  it('GPX is escaped and has the position and time', () => {
    const gpx = toGPX([obs({ notes: 'a < b & "c"' })], [project]);
    expect(gpx).toContain('<wpt lat="64.1466" lon="-21.9426">');
    expect(gpx).toContain('<ele>12</ele>');
    expect(gpx).toContain('<time>2026-06-03T14:30:00.000Z</time>');
    expect(gpx).toContain('a &lt; b &amp; &quot;c&quot;');
    expect(gpx).toContain('Strike/dip: 045/30 SE');
    expect(gpx).not.toContain('a < b');
  });

  it('CSV quotes cells and defuses spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(undefined)).toBe('');
    const csv = toCSV([obs()], [project]).trim().split('\n');
    expect(csv[0]).toMatch(/^recorded_at,project,type,latitude,longitude/);
    expect(csv[1]).toContain('Iceland,structure,64.1466,-21.9426,12,4,basalt');
    expect(csv[1]).toContain('"fresh, ""clean"" face"');
  });

  it('names an observation from its type, sample and rock', () => {
    expect(observationName(obs())).toBe('Structure: S-7 · basalt');
    expect(observationName(obs({ sampleId: undefined, rockType: undefined }))).toBe('Structure');
  });
});

describe('GPS formatting', () => {
  it('formats coordinates with hemispheres', () => {
    expect(formatCoords(64.1466, -21.9426)).toBe('64.14660° N, 21.94260° W');
    expect(formatCoords(-33.9, 18.4, 2)).toBe('33.90° S, 18.40° E');
  });
  it('rates accuracy', () => {
    expect([5, 10, 20, 31].map(accuracyLevel)).toEqual(['good', 'good', 'fair', 'poor']);
    expect(formatAccuracy(4.26)).toBe('±4.3 m');
    expect(formatAccuracy(4)).toBe('±4 m');
    expect(formatAccuracy(37.6)).toBe('±38 m');
  });
  it('formats strike and dip', () => {
    expect(formatStrikeDip({ strike: 5, dip: 7, dipDirection: 'N' })).toBe('005/07 N');
    expect(formatStrikeDip({ strike: 360, dip: 30 })).toBe('000/30');
    expect(formatStrikeDip({})).toBe('');
  });
  it('suggests the right-hand-rule dip direction', () => {
    expect([0, 45, 90, 180, 270, 315].map(suggestDipDirection)).toEqual(['E', 'SE', 'S', 'W', 'N', 'NE']);
  });
});
