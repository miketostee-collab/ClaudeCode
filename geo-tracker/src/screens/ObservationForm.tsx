import { useState } from 'react';
import { DIP_DIRECTIONS, OBSERVATION_TYPES, type ObservationType, type Project } from '../db';
import { suggestDipDirection } from '../geo';

/** The text-and-number fields of an observation, held as strings while typing. */
export interface FormValues {
  projectId: string;
  type: ObservationType;
  rockType: string;
  formation: string;
  description: string;
  sampleId: string;
  strike: string;
  dip: string;
  dipDirection: string;
  notes: string;
}

export const emptyForm = (projectId = ''): FormValues => ({
  projectId,
  type: 'outcrop',
  rockType: '',
  formation: '',
  description: '',
  sampleId: '',
  strike: '',
  dip: '',
  dipDirection: '',
  notes: '',
});

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

type Fields<N> = {
  projectId: string | N;
  type: ObservationType;
  rockType: string | N;
  formation: string | N;
  description: string | N;
  sampleId: string | N;
  strike: number | N;
  dip: number | N;
  dipDirection: string | N;
  notes: string | N;
};

/**
 * The form as values for the database. Empty fields come out undefined, or null when
 * `clear` is set (so that saving an edit removes them).
 */
export function formToFields(f: FormValues): Fields<undefined>;
export function formToFields(f: FormValues, clear: true): Fields<null>;
export function formToFields(f: FormValues, clear?: boolean): Fields<undefined> | Fields<null> {
  const none = clear ? null : undefined;
  const str = (s: string) => (s.trim() ? s.trim() : none);
  return {
    projectId: f.projectId || none,
    type: f.type,
    rockType: str(f.rockType),
    formation: str(f.formation),
    description: str(f.description),
    sampleId: str(f.sampleId),
    strike: num(f.strike) ?? none,
    dip: num(f.dip) ?? none,
    dipDirection: f.dipDirection || none,
    notes: str(f.notes),
  } as Fields<undefined> | Fields<null>;
}

export default function ObservationForm({
  value,
  onChange,
  projects,
  onNewProject,
}: {
  value: FormValues;
  onChange: (v: FormValues) => void;
  projects: Project[];
  onNewProject?: () => void;
}) {
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => onChange({ ...value, [k]: v });
  const [showMore, setShowMore] = useState(!!(value.formation || value.description || value.sampleId));
  const showStructure = value.type === 'structure' || !!value.strike || !!value.dip;

  return (
    <div className="stack">
      <div className="field">
        <span className="label">Type</span>
        <div className="chips" role="radiogroup" aria-label="Observation type">
          {OBSERVATION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={value.type === t.id}
              className={value.type === t.id ? 'chip active' : 'chip'}
              onClick={() => set('type', t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="label">Project</span>
        <select className="select" value={value.projectId} onChange={(e) => set('projectId', e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {onNewProject && (
          <button type="button" className="link left" onClick={onNewProject}>
            + New project
          </button>
        )}
      </label>

      <label className="field">
        <span className="label">Rock type</span>
        <input
          className="text-input"
          value={value.rockType}
          onChange={(e) => set('rockType', e.target.value)}
          placeholder="e.g. basalt, sandstone"
          autoCapitalize="sentences"
        />
      </label>

      {showStructure && (
        <div className="stack">
          <div className="row">
            <label className="field">
              <span className="label">Strike (0–360°)</span>
              <input
                className="text-input"
                type="number"
                inputMode="decimal"
                min={0}
                max={360}
                value={value.strike}
                onChange={(e) => {
                  const strike = e.target.value;
                  // Suggest the dip direction from the strike until one has been chosen.
                  const s = Number(strike);
                  const suggest = strike.trim() !== '' && Number.isFinite(s) && !value.dipDirection ? suggestDipDirection(s) : value.dipDirection;
                  onChange({ ...value, strike, dipDirection: suggest });
                }}
              />
            </label>
            <label className="field">
              <span className="label">Dip (0–90°)</span>
              <input
                className="text-input"
                type="number"
                inputMode="decimal"
                min={0}
                max={90}
                value={value.dip}
                onChange={(e) => set('dip', e.target.value)}
              />
            </label>
          </div>
          <div className="field">
            <span className="label">Dips towards</span>
            <div className="chips" role="radiogroup" aria-label="Dip direction">
              {DIP_DIRECTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={value.dipDirection === d}
                  className={value.dipDirection === d ? 'chip small active' : 'chip small'}
                  onClick={() => set('dipDirection', value.dipDirection === d ? '' : d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!showStructure && (
        <button type="button" className="link left" onClick={() => set('type', 'structure')}>
          + Add strike and dip
        </button>
      )}

      {showMore ? (
        <>
          <label className="field">
            <span className="label">Formation / unit</span>
            <input className="text-input" value={value.formation} onChange={(e) => set('formation', e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Sample number</span>
            <input className="text-input" value={value.sampleId} onChange={(e) => set('sampleId', e.target.value)} autoCapitalize="characters" />
          </label>
          <label className="field">
            <span className="label">Description (colour, texture, weathering…)</span>
            <textarea className="text-input area" rows={3} value={value.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </>
      ) : (
        <button type="button" className="link left" onClick={() => setShowMore(true)}>
          + Formation, sample number, description
        </button>
      )}

      <label className="field">
        <span className="label">Notes</span>
        <textarea className="text-input area" rows={3} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  );
}
