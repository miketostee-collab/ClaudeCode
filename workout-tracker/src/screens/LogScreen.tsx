import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addEntry, getLastEntry, listEntries, localDate, timestampForDay, type Exercise, type Unit } from '../db';
import { fmtNum, formatDate, formatMaxSet, relativeDay, entryTime } from '../prefs';
import ExercisePicker from './ExercisePicker';
import MaxSetEditor, { EMPTY_MAX_SET, maxSetComplete, maxSetFrom, toMaxSet, type MaxSetInput } from './MaxSetEditor';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: string | null) => void;
  unit: Unit;
}

export default function LogScreen({ exercises, selected, onSelect, unit }: Props) {
  const today = localDate();
  // The day being logged: today unless a past day is picked.
  const [picked, setDay] = useState(today);
  const day = picked > today ? today : picked;
  const exId = selected?.id ?? null;

  // Wrapped in an object so "loading" (undefined) differs from "no history" ({ last: undefined }).
  const data = useLiveQuery(async () => {
    if (exId == null) return null;
    const [last, all] = await Promise.all([getLastEntry(exId), listEntries(exId)]);
    return { last, todays: all.filter((e) => e.date === day) };
  }, [exId, day]);

  const [rows, setRows] = useState<MaxSetInput>(EMPTY_MAX_SET);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  // Pre-fill the max set from the last session whenever the exercise (or its latest entry) changes.
  const lastKey = data ? `${exId}:${data.last?.id ?? 'none'}:${unit}` : null;
  useEffect(() => {
    if (!data || lastKey === prefilledFor) return;
    const last = data.last;
    setRows(maxSetFrom(last, unit));
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
      await addEntry({ exerciseId: exId, unit, ...toMaxSet(rows), notes, timestamp: timestampForDay(day) });
      setError(null);
      setToast(`Saved ${selected!.name}${day === today ? '' : ` for ${formatDate(day)}`}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const last = data?.last;
  const canSave = exId != null && maxSetComplete(rows);

  return (
    <div className="stack">
      <ExercisePicker exercises={exercises} selected={selected} onSelect={onSelect} />

      {selected && (
        <section className="card last-card" aria-live="polite">
          <div className="card-kicker">
            Last max set{last ? ` · ${relativeDay(last.date, today)}` : ''}
          </div>
          {data === undefined ? (
            <div className="muted">Loading…</div>
          ) : last ? (
            <>
              <div className="set-list-v max-set-last">
                <strong>{fmtNum(last.weight)}</strong> {last.unit} × <strong>{last.reps}</strong> reps
              </div>
              {last.notes && <div className="muted small">{last.notes}</div>}
            </>
          ) : (
            <div className="muted">No entries yet. Your first one starts the history.</div>
          )}
        </section>
      )}

      {selected && (
        <form className="card stack" onSubmit={save}>
          <label className="field">
            <span className="label">Date</span>
            <input
              className="text-input"
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </label>
          <MaxSetEditor value={rows} onChange={setRows} unit={unit} />
          <label className="field">
            <span className="label">Notes (optional)</span>
            <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. felt strong" />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={!canSave}>
            Save entry
          </button>
        </form>
      )}

      {selected && data && data.todays.length > 0 && (
        <section className="card">
          <div className="card-kicker">Logged {day === today ? 'today' : `on ${formatDate(day)}`}</div>
          <ul className="plain-list">
            {data.todays.map((e) => (
              <li key={e.id} className="list-row">
                <span>{formatMaxSet(e)}</span>
                <span className="muted small">
                  {entryTime(e.timestamp)}
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
