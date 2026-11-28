import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addExercise, countEntries, deleteExercise, listEntries, localDate, renameExercise, type Exercise } from '../db';
import { guideFor, photosFor } from '../exerciseGuide';
import { formatMaxSet, relativeDay } from '../prefs';

export default function ExercisesScreen({ exercises }: { exercises: Exercise[] }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);

  const open = exercises.find((e) => e.id === viewing);
  if (open) return <ExerciseDetail exercise={open} onBack={() => setViewing(null)} />;

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

  const q = query.trim().toLowerCase();
  const shown = exercises.filter((ex) => {
    if (!q) return true;
    const g = guideFor(ex);
    return ex.name.toLowerCase().includes(q) || !!g?.primary.some((m) => m.toLowerCase().includes(q));
  });

  return (
    <div className="stack">
      <input
        className="text-input"
        type="search"
        placeholder="Search by name or muscle"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search exercises"
      />

      <section className="card">
        <p className="muted small">Tap an exercise for how to do it and the muscles it works.</p>
        <ul className="plain-list">
          {shown.map((ex) => {
            const g = guideFor(ex);
            return (
              <li key={ex.id} className="list-row">
                <button
                  className="row-main ex-row"
                  onClick={() => {
                    setViewing(ex.id);
                    window.scrollTo(0, 0);
                  }}
                >
                  <span>
                    <strong>{ex.name}</strong>
                    {g && <div className="muted small">{g.primary.join(', ')}</div>}
                  </span>
                  <span className="muted" aria-hidden>›</span>
                </button>
              </li>
            );
          })}
        </ul>
        {exercises.length === 0 && <p className="muted">No exercises. Add one below.</p>}
        {exercises.length > 0 && shown.length === 0 && <p className="muted">No exercises match.</p>}
      </section>

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
    </div>
  );
}

function ExerciseDetail({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const guide = guideFor(exercise);
  const photos = photosFor(exercise);
  const [renaming, setRenaming] = useState(false);
  const today = localDate();
  const stats = useLiveQuery(async () => {
    const entries = await listEntries(exercise.id);
    if (entries.length === 0) return { last: undefined, best: undefined, count: 0 };
    // Best: heaviest weight (in kg terms), then most reps at it.
    const kg = (e: (typeof entries)[number]) => (e.unit === 'lb' ? e.weight / 2.20462 : e.weight);
    const best = entries.reduce((b, e) => (kg(e) > kg(b) || (kg(e) === kg(b) && e.reps > b.reps) ? e : b));
    return { last: entries[0], best, count: entries.length };
  }, [exercise.id]);

  async function remove() {
    const n = await countEntries(exercise.id);
    const msg = n
      ? `Delete "${exercise.name}" and its ${n} logged ${n === 1 ? 'entry' : 'entries'}? This can't be undone.`
      : `Delete "${exercise.name}"?`;
    if (confirm(msg)) {
      await deleteExercise(exercise.id);
      onBack();
    }
  }

  return (
    <div className="stack">
      <button className="link back-link" onClick={onBack}>
        ‹ All exercises
      </button>

      <section className="card stack">
        {renaming ? (
          <RenameForm exercise={exercise} onDone={() => setRenaming(false)} />
        ) : (
          <h2 className="ex-title">{exercise.name}</h2>
        )}
        {photos && (
          <figure className="ex-photos">
            <div className="ex-photo-pair">
              {photos.map((src, i) => (
                <img key={src} src={src} alt={`${exercise.name}: ${i === 0 ? 'start' : 'finish'} position`} loading="lazy" />
              ))}
            </div>
            <figcaption className="muted small">Start and finish. Photos: Free Exercise DB (public domain).</figcaption>
          </figure>
        )}
        {guide ? (
          <>
            <p>{guide.summary}</p>
            <div>
              <div className="card-kicker">Muscles worked</div>
              <div className="chips">
                {guide.primary.map((m) => (
                  <span key={m} className="chip primary-chip">{m}</span>
                ))}
                {guide.secondary.map((m) => (
                  <span key={m} className="chip">{m}</span>
                ))}
              </div>
              {guide.secondary.length > 0 && <p className="muted small">Main muscles are highlighted; the rest assist.</p>}
            </div>
            <div>
              <div className="card-kicker">Equipment</div>
              <p className="small">{guide.equipment}</p>
            </div>
          </>
        ) : (
          <p className="muted small">
            This is an exercise you added, so there's no built-in guide for it.
          </p>
        )}
      </section>

      {guide && (
        <section className="card stack">
          <div className="card-kicker">How to do it</div>
          <ol className="guide-steps">
            {guide.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {guide.tips.length > 0 && (
            <>
              <div className="card-kicker">Tips</div>
              <ul className="guide-tips">
                {guide.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="card stack">
        <div className="card-kicker">Your max sets</div>
        {!stats ? (
          <p className="muted small">Loading…</p>
        ) : stats.count === 0 ? (
          <p className="muted small">Not logged yet.</p>
        ) : (
          <ul className="plain-list">
            <li className="list-row">
              <span>Last · {relativeDay(stats.last!.date, today)}</span>
              <strong>{formatMaxSet(stats.last!)}</strong>
            </li>
            <li className="list-row">
              <span>Best · {relativeDay(stats.best!.date, today)}</span>
              <strong>{formatMaxSet(stats.best!)}</strong>
            </li>
          </ul>
        )}
      </section>

      <div className="row">
        <button className="secondary" onClick={() => setRenaming(true)} disabled={renaming}>
          Rename
        </button>
        <button className="danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function RenameForm({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
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
    <form className="stack" onSubmit={save}>
      <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Exercise name" />
      <div className="row">
        <button className="secondary" type="button" onClick={onDone}>Cancel</button>
        <button className="primary" type="submit">Save</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  );
}
