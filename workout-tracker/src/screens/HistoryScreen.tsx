import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteEntry, listEntries, localDate, updateEntry, type Entry, type Exercise, type Unit } from '../db';
import { formatDate, formatMaxSet, relativeDay, entryTime } from '../prefs';
import ExercisePicker from './ExercisePicker';
import HistoryChart from './HistoryChart';
import MaxSetEditor, { maxSetComplete, maxSetFrom, toMaxSet } from './MaxSetEditor';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: string | null) => void;
  unit: Unit;
}

export default function HistoryScreen({ exercises, selected, onSelect, unit }: Props) {
  const exId = selected?.id ?? null;
  const entries = useLiveQuery(() => (exId == null ? [] : listEntries(exId)), [exId]);
  const [editing, setEditing] = useState<string | null>(null);
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
      {selected && entries && entries.length > 0 && <HistoryChart entries={entries} unit={unit} />}
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
                    <strong>{formatMaxSet(e)}</strong>
                    {e.notes && <div className="muted small">{e.notes}</div>}
                  </button>
                  <span className="muted small">
                    {entryTime(e.timestamp)}
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
  const [rows, setRows] = useState(() => maxSetFrom(entry, entry.unit));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [date, setDate] = useState(entry.date);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await updateEntry(entry.id, { ...toMaxSet(rows), notes, date });
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
      <MaxSetEditor value={rows} onChange={setRows} unit={entry.unit} />
      {entry.workoutId ? (
        <p className="muted small">Logged in the workout on {formatDate(entry.date)}. To change its day, edit that workout.</p>
      ) : (
        <label className="field">
          <span className="label">Date</span>
          <input className="text-input" type="date" value={date} max={localDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span className="label">Notes</span>
        <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="row">
        <button className="danger" onClick={remove}>Delete</button>
        <button className="secondary" onClick={onDone}>Cancel</button>
        <button className="primary" onClick={save} disabled={!maxSetComplete(rows)}>Save</button>
      </div>
    </li>
  );
}
