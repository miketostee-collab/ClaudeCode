import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listObservations, listProjects, OBSERVATION_TYPES, type Observation, type ObservationType } from '../db';
import { formatCoords, formatStrikeDip } from '../geo';
import { observationName } from '../export';
import { formatDate } from '../prefs';

function matches(o: Observation, q: string) {
  if (!q) return true;
  const hay = [o.rockType, o.formation, o.description, o.sampleId, o.notes, o.type].filter(Boolean).join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export default function ListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const observations = useLiveQuery(() => listObservations(), []);
  const projects = useLiveQuery(() => listProjects(), []);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<ObservationType | ''>('');
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () =>
      (observations ?? []).filter(
        (o) => (!projectId || o.projectId === projectId) && (!type || o.type === type) && matches(o, query.trim()),
      ),
    [observations, projectId, type, query],
  );

  if (!observations || !projects) return <p className="muted">Loading…</p>;
  if (observations.length === 0) {
    return <p className="muted center">Nothing recorded yet. Use the Record tab to save your first observation.</p>;
  }

  const byDate = new Map<string, Observation[]>();
  for (const o of shown) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;

  return (
    <div className="stack">
      <input
        className="text-input"
        type="search"
        placeholder="Search rock, formation, sample, notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="row">
        <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as ObservationType | '')} aria-label="Type">
          <option value="">All types</option>
          {OBSERVATION_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">
        {shown.length} of {observations.length} observation{observations.length === 1 ? '' : 's'}
      </p>
      {shown.length === 0 && <p className="muted center">No observations match.</p>}
      {[...byDate].map(([date, items]) => (
        <section key={date} className="card">
          <div className="card-kicker">{formatDate(date)}</div>
          <ul className="plain-list">
            {items.map((o) => (
              <li key={o.id} className="list-row">
                <button className="row-main" onClick={() => onOpen(o.id)}>
                  <strong>{observationName(o)}</strong>
                  <div className="muted small">
                    {new Date(o.recordedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    {projectName(o.projectId) && ` · ${projectName(o.projectId)}`}
                    {formatStrikeDip(o) && ` · ${formatStrikeDip(o)}`}
                  </div>
                  <div className="muted small">{formatCoords(o.lat, o.lng, 4)}</div>
                </button>
                <span className="wx-chev" aria-hidden>
                  ›
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
