import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addEntry, getLastEntry, listEntries, localDate, type Exercise, type Unit } from '../db';
import { convertWeight, fmtNum, formatDate, relativeDay } from '../prefs';
import ExercisePicker from './ExercisePicker';
import Stepper from './Stepper';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: number | null) => void;
  unit: Unit;
}


export default function LogScreen({ exercises, selected, onSelect, unit }: Props) {
  const today = localDate();
  const exId = selected?.id ?? null;

  // Wrapped in an object so "loading" (undefined) differs from "no history" ({ last: undefined }).
  const data = useLiveQuery(async () => {
    if (exId == null) return null;
    const [last, all] = await Promise.all([getLastEntry(exId), listEntries(exId)]);
    return { last, todays: all.filter((e) => e.date === today) };
  }, [exId, today]);

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  // Pre-fill the form from the last session whenever the exercise (or its latest entry) changes.
  const lastKey = data ? `${exId}:${data.last?.id ?? 'none'}:${unit}` : null;
  useEffect(() => {
    if (!data || lastKey === prefilledFor) return;
    const last = data.last;
    setWeight(last ? fmtNum(convertWeight(last.weight, last.unit, unit)) : '');
    setReps(last ? String(last.reps) : '');
    setSets(last ? String(last.sets) : '');
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
      await addEntry({
        exerciseId: exId,
        weight: Number(weight),
        reps: Number(reps),
        sets: Number(sets),
        unit,
        notes,
      });
      setError(null);
      setToast(`Saved ${selected!.name}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const last = data?.last;
  const canSave = exId != null && weight !== '' && reps !== '' && sets !== '';

  return (
    <div className="stack">
      <ExercisePicker exercises={exercises} selected={selected} onSelect={onSelect} />

      {selected && (
        <section className="card last-card" aria-live="polite">
          <div className="card-kicker">Last time</div>
          {data === undefined ? (
            <div className="muted">Loading…</div>
          ) : last ? (
            <>
              <div className="last-main">
                <span className="big">{fmtNum(last.weight)}</span>
                <span className="unit">{last.unit}</span>
                <span className="times">×</span>
                <span className="big">{last.reps}</span>
                <span className="unit">reps</span>
                <span className="times">×</span>
                <span className="big">{last.sets}</span>
                <span className="unit">{last.sets === 1 ? 'set' : 'sets'}</span>
              </div>
              <div className="muted">
                {relativeDay(last.date, today)}
                {last.notes ? ` · ${last.notes}` : ''}
              </div>
            </>
          ) : (
            <div className="muted">No entries yet. Your first one starts the history.</div>
          )}
        </section>
      )}

      {selected && (
        <form className="card stack" onSubmit={save}>
          <div className="card-kicker">Today · {formatDate(today)}</div>
          <Stepper label="Weight" value={weight} onChange={setWeight} step={unit === 'kg' ? 2.5 : 5} min={0} decimal suffix={unit} />
          <div className="row">
            <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={1} />
            <Stepper label="Sets" value={sets} onChange={setSets} step={1} min={1} />
          </div>
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
                <span>
                  {fmtNum(e.weight)} {e.unit} × {e.reps} × {e.sets}
                </span>
                <span className="muted">
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
