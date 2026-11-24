import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addEntry, getLastEntry, listEntries, localDate, type Exercise, type Unit } from '../db';
import { convertWeight, fmtNum, formatDate, relativeDay, summarizeSets } from '../prefs';
import ExercisePicker from './ExercisePicker';
import SetsEditor, { rowsComplete, rowsToSets, type SetRow } from './SetsEditor';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: number | null) => void;
  unit: Unit;
}

const EMPTY_ROWS: SetRow[] = [{ weight: '', reps: '' }];

export default function LogScreen({ exercises, selected, onSelect, unit }: Props) {
  const today = localDate();
  const exId = selected?.id ?? null;

  // Wrapped in an object so "loading" (undefined) differs from "no history" ({ last: undefined }).
  const data = useLiveQuery(async () => {
    if (exId == null) return null;
    const [last, all] = await Promise.all([getLastEntry(exId), listEntries(exId)]);
    return { last, todays: all.filter((e) => e.date === today) };
  }, [exId, today]);

  const [rows, setRows] = useState<SetRow[]>(EMPTY_ROWS);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  // Pre-fill the sets from the last session whenever the exercise (or its latest entry) changes.
  const lastKey = data ? `${exId}:${data.last?.id ?? 'none'}:${unit}` : null;
  useEffect(() => {
    if (!data || lastKey === prefilledFor) return;
    const last = data.last;
    setRows(
      last
        ? last.sets.map((s) => ({ weight: fmtNum(convertWeight(s.weight, last.unit, unit)), reps: String(s.reps) }))
        : EMPTY_ROWS,
    );
    setNotes('');
    setError(null);
    setPrefilledFor(lastKey);
  }, [data, lastKey, prefilledFor, unit]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (exId == null) return;
    try {
      await addEntry({ exerciseId: exId, unit, sets: rowsToSets(rows), notes });
      setError(null);
      setToast(`Saved ${selected!.name}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const last = data?.last;
  const canSave = exId != null && rowsComplete(rows);

  return (
    <div className="stack">
      <ExercisePicker exercises={exercises} selected={selected} onSelect={onSelect} />

      {selected && (
        <section className="card last-card" aria-live="polite">
          <div className="card-kicker">
            Last time{last ? ` · ${relativeDay(last.date, today)}` : ''}
          </div>
          {data === undefined ? (
            <div className="muted">Loading…</div>
          ) : last ? (
            <>
              <ol className="set-list">
                {last.sets.map((s, i) => (
                  <li key={i}>
                    <span className="set-list-n">Set {i + 1}</span>
                    <span className="set-list-v">
                      <strong>{fmtNum(s.weight)}</strong> {last.unit} × <strong>{s.reps}</strong> reps
                    </span>
                  </li>
                ))}
              </ol>
              {last.notes && <div className="muted small">{last.notes}</div>}
            </>
          ) : (
            <div className="muted">No entries yet. Your first one starts the history.</div>
          )}
        </section>
      )}

      {selected && (
        <form className="card stack" onSubmit={save}>
          <div className="card-kicker">Today · {formatDate(today)}</div>
          <SetsEditor rows={rows} onChange={setRows} unit={unit} />
          <label className="field">
            <span className="label">Notes (optional)</span>
            <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. last set was hard" />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={!canSave}>
            Save entry
          </button>
        </form>
      )}

      {selected && data && data.todays.length > 0 && (
        <section className="card">
          <div className="card-kicker">Logged today</div>
          <ul className="plain-list">
            {data.todays.map((e) => (
              <li key={e.id} className="list-row">
                <span>{summarizeSets(e.sets, e.unit)}</span>
                <span className="muted small">
                  {new Date(e.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!selected && <p className="muted center">Pick an exercise to see your last session and log today's.</p>}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}
