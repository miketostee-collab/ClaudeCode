import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createWorkout,
  deleteWorkout,
  getStartingEntry,
  getWorkout,
  getWorkoutByDate,
  listWorkoutEntries,
  listWorkouts,
  localDate,
  repeatWorkout,
  saveWorkoutEntry,
  updateWorkout,
  type Entry,
  type Exercise,
  type Unit,
  type Workout,
} from '../db';
import { convertWeight, fmtNum, formatDate, relativeDay, summarizeSets } from '../prefs';
import ExerciseChecklist from './ExerciseChecklist';
import SetsEditor, { rowsComplete, rowsToSets, type SetRow } from './SetsEditor';

interface Props {
  exercises: Exercise[];
  unit: Unit;
}

export default function WorkoutScreen({ exercises, unit }: Props) {
  const [view, setView] = useState<'today' | 'previous'>('today');

  return (
    <div className="stack">
      <div className="segmented" role="tablist" aria-label="Workouts">
        <button role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'seg active' : 'seg'} onClick={() => setView('today')}>
          Today
        </button>
        <button role="tab" aria-selected={view === 'previous'} className={view === 'previous' ? 'seg active' : 'seg'} onClick={() => setView('previous')}>
          Previous
        </button>
      </div>
      {view === 'today' ? (
        <TodayWorkout exercises={exercises} unit={unit} />
      ) : (
        <PreviousWorkouts exercises={exercises} onRepeated={() => setView('today')} />
      )}
    </div>
  );
}

function nameMap(exercises: Exercise[]) {
  return new Map(exercises.map((e) => [e.id, e.name]));
}

// ---------------- Today ----------------

function TodayWorkout({ exercises, unit }: Props) {
  const today = localDate();
  const data = useLiveQuery(async () => {
    const workout = await getWorkoutByDate(today);
    const entries = workout ? await listWorkoutEntries(workout.id) : [];
    return { workout, entries };
  }, [today]);
  const [editing, setEditing] = useState(false);

  if (!data) return <p className="muted">Loading…</p>;
  if (!data.workout) return <StartWorkout exercises={exercises} />;
  if (editing) {
    return <EditWorkout workout={data.workout} entries={data.entries} exercises={exercises} onDone={() => setEditing(false)} />;
  }
  return <ActiveWorkout key={data.workout.id} workout={data.workout} entries={data.entries} exercises={exercises} unit={unit} onEdit={() => setEditing(true)} />;
}

function StartWorkout({ exercises }: { exercises: Exercise[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recent = useLiveQuery(async () => {
    const ws = (await listWorkouts()).slice(0, 5);
    const entries = await Promise.all(ws.map((w) => listWorkoutEntries(w.id)));
    return ws.map((w, i) => ({ w, entries: entries[i] }));
  }, []);

  async function start() {
    try {
      await createWorkout({ exerciseIds: selected, name });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      {recent && recent.length > 0 && (
        <section className="card stack repeat-card">
          <div>
            <div className="card-kicker">Repeat a previous workout</div>
            <p className="muted small">
              Same exercises and sets, pre-filled with that day's weights and reps. Just update the numbers.
            </p>
          </div>
          {recent.map(({ w, entries }) => (
            <RepeatOption key={w.id} workout={w} entries={entries} exercises={exercises} onError={setError} />
          ))}
        </section>
      )}

      <section className="card stack">
        <div className="card-kicker">
          {recent && recent.length > 0 ? 'Or build a new workout' : `Start today's workout · ${formatDate(localDate())}`}
        </div>
        <label className="field">
          <span className="label">Name (optional)</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
        </label>
        <span className="label">Pick today's exercises</span>
        <ExerciseChecklist exercises={exercises} selected={selected} onChange={setSelected} />
        {error && <div className="error" role="alert">{error}</div>}
        {/* Only float the button once something is picked, so it doesn't cover the Repeat options. */}
        <div className={selected.length > 0 ? 'sticky-action' : undefined}>
          <button className="primary full" disabled={selected.length === 0} onClick={start}>
            {selected.length === 0 ? 'Pick at least one exercise' : `Start workout · ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </>
  );
}

/** One previous workout with a one-tap Repeat button. */
function RepeatOption({
  workout,
  entries,
  exercises,
  onError,
  onRepeated,
  replaceLogged,
}: {
  workout: Workout;
  entries: Entry[];
  exercises: Exercise[];
  onError: (msg: string) => void;
  onRepeated?: () => void;
  /** If set, today's workout already exists and will be replaced; the number of exercises logged in it. */
  replaceLogged?: number;
}) {
  const names = nameMap(exercises);
  const setCount = new Map(entries.map((e) => [e.exerciseId, e.sets.length]));
  const today = localDate();
  const items = workout.exerciseIds.filter((id) => names.has(id));

  async function repeat() {
    try {
      if (replaceLogged && !confirm(`Replace today's workout? The ${replaceLogged} exercise${replaceLogged === 1 ? '' : 's'} you've logged today will be removed.`)) return;
      await repeatWorkout(workout.id, undefined, undefined, replaceLogged !== undefined);
      onRepeated?.();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <div className="repeat-option">
      <div className="repeat-info">
        <strong>{workout.name || formatDate(workout.date)}</strong>
        <span className="muted small">
          {workout.name ? `${relativeDay(workout.date, today)} · ` : relativeDay(workout.date, today) !== formatDate(workout.date) ? `${relativeDay(workout.date, today)} · ` : ''}
          {items.length} exercise{items.length === 1 ? '' : 's'}
        </span>
        <ul className="repeat-list">
          {items.map((id) => (
            <li key={id}>
              {names.get(id)}
              {setCount.has(id) && <span className="muted"> · {setCount.get(id)} set{setCount.get(id) === 1 ? '' : 's'}</span>}
            </li>
          ))}
        </ul>
      </div>
      <button className="primary shrink" onClick={repeat} aria-label={`Repeat ${workout.name || formatDate(workout.date)}`}>
        Repeat
      </button>
    </div>
  );
}

function ActiveWorkout({
  workout,
  entries,
  exercises,
  unit,
  onEdit,
}: {
  workout: Workout;
  entries: Entry[];
  exercises: Exercise[];
  unit: Unit;
  onEdit: () => void;
}) {
  const names = nameMap(exercises);
  const byExercise = new Map(entries.map((e) => [e.exerciseId, e]));
  const done = workout.exerciseIds.filter((id) => byExercise.has(id)).length;
  const firstOpen = workout.exerciseIds.find((id) => !byExercise.has(id)) ?? null;
  const [open, setOpen] = useState<number | null>(firstOpen);

  async function remove() {
    if (!confirm(`Delete today's workout and the ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} logged in it?`)) return;
    await deleteWorkout(workout.id);
  }

  return (
    <>
      <section className="card workout-head">
        <div>
          <div className="card-kicker">Today · {formatDate(workout.date)}</div>
          <div className="workout-title">{workout.name || "Today's workout"}</div>
          {workout.copiedFrom != null && <RepeatedFrom id={workout.copiedFrom} />}
          <div className="muted small">
            {done} of {workout.exerciseIds.length} exercises logged
          </div>
          <div className="progress" aria-hidden>
            <div style={{ width: `${(done / Math.max(1, workout.exerciseIds.length)) * 100}%` }} />
          </div>
        </div>
        <button className="secondary shrink" onClick={onEdit}>
          Edit
        </button>
      </section>

      {workout.exerciseIds.map((id, i) => (
        <WorkoutExerciseCard
          key={id}
          index={i}
          workout={workout}
          exerciseId={id}
          name={names.get(id) ?? 'Deleted exercise'}
          entry={byExercise.get(id)}
          unit={unit}
          open={open === id}
          onToggle={() => setOpen(open === id ? null : id)}
          onSaved={() => {
            // Move on to the next exercise that still needs logging.
            const next = workout.exerciseIds.find((x) => x !== id && !byExercise.has(x));
            setOpen(next ?? null);
          }}
        />
      ))}

      {done === workout.exerciseIds.length && <p className="success center">✓ All exercises logged. Nice work.</p>}

      <RepeatInstead workout={workout} logged={done} exercises={exercises} />

      <button className="link danger-text center-link" onClick={remove}>
        Delete today's workout
      </button>
    </>
  );
}

/** Lets you swap today's workout for a repeat of a previous one, even after starting. */
function RepeatInstead({ workout, logged, exercises }: { workout: Workout; logged: number; exercises: Exercise[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useLiveQuery(async () => {
    const ws = (await listWorkouts()).filter((w) => w.date !== workout.date).slice(0, 5);
    const entries = await Promise.all(ws.map((w) => listWorkoutEntries(w.id)));
    return ws.map((w, i) => ({ w, entries: entries[i] }));
  }, [workout.date]);

  if (!recent || recent.length === 0) return null;
  return (
    <section className="card stack">
      <button className="link repeat-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        ↻ Repeat a previous workout instead {open ? '▴' : '▾'}
      </button>
      {open && (
        <>
          <p className="muted small">
            Replaces today's workout with the same exercises and sets as the one you pick
            {logged > 0 ? `. The ${logged} exercise${logged === 1 ? '' : 's'} you've logged today will be removed.` : '.'}
          </p>
          {recent.map(({ w, entries }) => (
            <RepeatOption key={w.id} workout={w} entries={entries} exercises={exercises} onError={setError} replaceLogged={logged} />
          ))}
          {error && <div className="error" role="alert">{error}</div>}
        </>
      )}
    </section>
  );
}

function RepeatedFrom({ id }: { id: number }) {
  const source = useLiveQuery(async () => ({ w: await getWorkout(id) }), [id]);
  if (!source?.w) return null;
  return <div className="muted small">Repeated from {formatDate(source.w.date)}</div>;
}

function WorkoutExerciseCard({
  index,
  workout,
  exerciseId,
  name,
  entry,
  unit,
  open,
  onToggle,
  onSaved,
}: {
  index: number;
  workout: Workout;
  exerciseId: number;
  name: string;
  entry: Entry | undefined;
  unit: Unit;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  // What this exercise starts from: the repeated workout's sets, else the last time it was done.
  const last = useLiveQuery(async () => ({ e: await getStartingEntry(workout, exerciseId) }), [exerciseId, workout.id, workout.copiedFrom]);

  return (
    <section className={entry ? 'card wx done' : 'card wx'}>
      <button className="wx-head" onClick={onToggle} aria-expanded={open}>
        <span className={entry ? 'wx-num done' : 'wx-num'}>{entry ? '✓' : index + 1}</span>
        <span className="wx-main">
          <strong>{name}</strong>
          <span className="muted small">
            {entry
              ? summarizeSets(entry.sets, entry.unit)
              : last?.e
                ? `Last: ${summarizeSets(last.e.sets, last.e.unit)} · ${relativeDay(last.e.date, workout.date)}`
                : 'No history yet'}
          </span>
        </span>
        <span className="wx-chev" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && last && (
        <WorkoutEntryForm
          key={entry?.id ?? 'new'}
          workout={workout}
          exerciseId={exerciseId}
          entry={entry}
          last={last.e}
          unit={unit}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

function WorkoutEntryForm({
  workout,
  exerciseId,
  entry,
  last,
  unit,
  onSaved,
}: {
  workout: Workout;
  exerciseId: number;
  entry: Entry | undefined;
  last: Entry | undefined;
  unit: Unit;
  onSaved: () => void;
}) {
  // Editing keeps the entry's own unit; a new entry uses the current setting, pre-filled from last time.
  const formUnit = entry?.unit ?? unit;
  const [rows, setRows] = useState<SetRow[]>(() => {
    if (entry) return entry.sets.map((s) => ({ weight: fmtNum(s.weight), reps: String(s.reps) }));
    if (last) return last.sets.map((s) => ({ weight: fmtNum(convertWeight(s.weight, last.unit, formUnit)), reps: String(s.reps) }));
    return [{ weight: '', reps: '' }];
  });
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveWorkoutEntry(workout.id, exerciseId, { unit: formUnit, sets: rowsToSets(rows), notes });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="stack wx-body" onSubmit={save}>
      {last && !entry && (
        <ol className="set-list compact">
          {last.sets.map((s, i) => (
            <li key={i}>
              <span className="set-list-n">Last {i + 1}</span>
              <span className="muted">
                {fmtNum(s.weight)} {last.unit} × {s.reps}
              </span>
            </li>
          ))}
        </ol>
      )}
      <SetsEditor rows={rows} onChange={setRows} unit={formUnit} />
      <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={!rowsComplete(rows)}>
        {entry ? 'Update' : 'Save'}
      </button>
    </form>
  );
}

function EditWorkout({
  workout,
  entries,
  exercises,
  onDone,
}: {
  workout: Workout;
  entries: Entry[];
  exercises: Exercise[];
  onDone: () => void;
}) {
  const names = nameMap(exercises);
  const [selected, setSelected] = useState<number[]>(workout.exerciseIds);
  const [name, setName] = useState(workout.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  };

  async function save() {
    const losing = entries.filter((e) => !selected.includes(e.exerciseId));
    if (
      losing.length &&
      !confirm(`This removes the logged sets for ${losing.map((e) => names.get(e.exerciseId)).join(', ')}. Continue?`)
    )
      return;
    try {
      await updateWorkout(workout.id, { exerciseIds: selected, name });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card stack">
      <div className="card-kicker">Edit today's workout</div>
      <label className="field">
        <span className="label">Name (optional)</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
      </label>
      {selected.length > 0 && (
        <>
          <span className="label">Order</span>
          <ol className="plain-list">
            {selected.map((id, i) => (
              <li key={id} className="list-row">
                <span>
                  {i + 1}. {names.get(id)}
                </span>
                <span className="row tight">
                  <button className="link" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${names.get(id)} up`}>
                    ↑
                  </button>
                  <button className="link" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label={`Move ${names.get(id)} down`}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <span className="label">Exercises</span>
      <ExerciseChecklist exercises={exercises} selected={selected} onChange={setSelected} />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="row sticky-action">
        <button className="secondary" onClick={onDone}>
          Cancel
        </button>
        <button className="primary" onClick={save} disabled={selected.length === 0}>
          Save changes
        </button>
      </div>
    </section>
  );
}

// ---------------- Previous ----------------

function PreviousWorkouts({ exercises, onRepeated }: { exercises: Exercise[]; onRepeated: () => void }) {
  const today = localDate();
  const names = nameMap(exercises);
  const data = useLiveQuery(async () => {
    const [workouts, todays] = await Promise.all([listWorkouts(), getWorkoutByDate(today)]);
    const past = workouts.filter((w) => w.date !== today);
    const entries = await Promise.all(past.map((w) => listWorkoutEntries(w.id)));
    const todayLogged = todays ? (await listWorkoutEntries(todays.id)).length : null;
    return { items: past.map((w, i) => ({ w, entries: entries[i] })), todayLogged };
  }, [today]);

  if (!data) return <p className="muted">Loading…</p>;
  if (data.items.length === 0) return <p className="muted center">No previous workouts yet. They'll appear here after today.</p>;

  return (
    <>
      {data.items.map(({ w, entries }) => {
        const byExercise = new Map(entries.map((e) => [e.exerciseId, e]));
        return (
          <section key={w.id} className="card stack">
            <div>
              <div className="card-kicker">{relativeDay(w.date, today)}{relativeDay(w.date, today) !== formatDate(w.date) ? ` · ${formatDate(w.date)}` : ''}</div>
              {w.name && <div className="workout-title">{w.name}</div>}
            </div>
            <ul className="plain-list">
              {w.exerciseIds.map((id) => {
                const e = byExercise.get(id);
                return (
                  <li key={id} className="prev-row">
                    <strong>{names.get(id) ?? 'Deleted exercise'}</strong>
                    {e ? (
                      <ol className="set-list compact">
                        {e.sets.map((s, i) => (
                          <li key={i}>
                            <span className="set-list-n">Set {i + 1}</span>
                            <span>
                              {fmtNum(s.weight)} {e.unit} × {s.reps}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="muted small">Not logged</div>
                    )}
                    {e?.notes && <div className="muted small">{e.notes}</div>}
                  </li>
                );
              })}
            </ul>
            <div className="row tight">
              <button
                className="primary shrink"
                onClick={async () => {
                  const n = data.todayLogged;
                  if (n && !confirm(`Replace today's workout? The ${n} exercise${n === 1 ? '' : 's'} you've logged today will be removed.`)) return;
                  await repeatWorkout(w.id, undefined, undefined, n !== null);
                  onRepeated();
                }}
              >
                Repeat today
              </button>
              <button
                className="link danger-text"
                onClick={async () => {
                  if (confirm(`Delete the workout from ${formatDate(w.date)} and its logged sets?`)) await deleteWorkout(w.id);
                }}
              >
                Delete
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}
