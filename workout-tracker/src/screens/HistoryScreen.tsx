import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteEntry, listEntries, localDate, updateEntry, type Entry, type Exercise } from '../db';
import { fmtNum, relativeDay } from '../prefs';
import ExercisePicker from './ExercisePicker';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: number | null) => void;
}

export default function HistoryScreen({ exercises, selected, onSelect }: Props) {
  const exId = selected?.id ?? null;
  const entries = useLiveQuery(() => (exId == null ? [] : listEntries(exId)), [exId]);
  const [editing, setEditing] = useState<number | null>(null);
  const today = localDate();

  // Group by day, keeping newest-first order.
  const groups: { date: string; items: Entry[] }[] = [];
  for (const e of entries ?? []) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <div className="stack">
      <ExercisePicker exercises={exercises} selected={selected} onSelect={onSelect} />
      {!selected && <p className="muted center">Pick an exercise to see its history.</p>}
      {selected && entries && entries.length === 0 && <p className="muted center">No entries for {selected.name} yet.</p>}
      {groups.map((g) => (
        <section key={g.date} className="card">
          <div className="card-kicker">{relativeDay(g.date, today)}</div>
          <ul className="plain-list">
            {g.items.map((e) =>
              editing === e.id ? (
                <EditRow key={e.id} entry={e} onDone={() => setEditing(null)} />
              ) : (
                <li key={e.id} className="list-row">
                  <button className="row-main" onClick={() => setEditing(e.id)} aria-label="Edit entry">
                    <strong>
                      {fmtNum(e.weight)} {e.unit}
                    </strong>{' '}
                    × {e.reps} reps × {e.sets} {e.sets === 1 ? 'set' : 'sets'}
                    {e.notes && <div className="muted small">{e.notes}</div>}
                  </button>
                  <span className="muted small">
                    {new Date(e.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EditRow({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const [weight, setWeight] = useState(fmtNum(entry.weight));
  const [reps, setReps] = useState(String(entry.reps));
  const [sets, setSets] = useState(String(entry.sets));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await updateEntry(entry.id, { weight: Number(weight), reps: Number(reps), sets: Number(sets), notes });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm('Delete this entry?')) return;
    await deleteEntry(entry.id);
    onDone();
  }

  return (
    <li className="edit-row stack">
      <div className="row">
        <label className="field">
          <span className="label">Weight ({entry.unit})</span>
          <input className="text-input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(',', '.'))} />
        </label>
        <label className="field">
          <span className="label">Reps</span>
          <input className="text-input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Sets</span>
          <input className="text-input" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="label">Notes</span>
        <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="row">
        <button className="danger" onClick={remove}>Delete</button>
        <button className="secondary" onClick={onDone}>Cancel</button>
        <button className="primary" onClick={save}>Save</button>
      </div>
    </li>
  );
}
