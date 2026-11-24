import { useState } from 'react';
import { addExercise, countEntries, deleteExercise, renameExercise, type Exercise } from '../db';

export default function ExercisesScreen({ exercises }: { exercises: Exercise[] }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addExercise(name);
      setName('');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={add}>
        <label className="field">
          <span className="label">Add an exercise</span>
          <div className="row">
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline Dumbbell Press" />
            <button className="primary shrink" type="submit" disabled={!name.trim()}>
              Add
            </button>
          </div>
        </label>
        {error && <div className="error" role="alert">{error}</div>}
      </form>

      <section className="card">
        <ul className="plain-list">
          {exercises.map((ex) =>
            editing === ex.id ? (
              <RenameRow key={ex.id} exercise={ex} onDone={() => setEditing(null)} />
            ) : (
              <li key={ex.id} className="list-row">
                <span>{ex.name}</span>
                <span className="row tight">
                  <button className="link" onClick={() => setEditing(ex.id)}>Rename</button>
                  <button className="link danger-text" onClick={() => remove(ex)}>Delete</button>
                </span>
              </li>
            ),
          )}
        </ul>
        {exercises.length === 0 && <p className="muted">No exercises. Add one above.</p>}
      </section>
    </div>
  );
}

async function remove(ex: Exercise) {
  const n = await countEntries(ex.id);
  const msg = n
    ? `Delete "${ex.name}" and its ${n} logged ${n === 1 ? 'entry' : 'entries'}? This can't be undone.`
    : `Delete "${ex.name}"?`;
  if (confirm(msg)) await deleteExercise(ex.id);
}

function RenameRow({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await renameExercise(exercise.id, name);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <li className="edit-row">
      <form className="stack" onSubmit={save}>
        <div className="row">
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Exercise name" />
          <button className="secondary shrink" type="button" onClick={onDone}>Cancel</button>
          <button className="primary shrink" type="submit">Save</button>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
      </form>
    </li>
  );
}
