import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createWorkout,
  deleteWorkout,
  getStartingEntry,
  getWorkout,
  getWorkoutByDate,
  listEntries,
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
import { formatDate, formatMaxSet, relativeDay } from '../prefs';
import ExerciseChecklist from './ExerciseChecklist';
import HistoryChart from './HistoryChart';
import MaxSetEditor, { maxSetComplete, maxSetFrom, toMaxSet, type MaxSetInput } from './MaxSetEditor';

interface Props {
  exercises: Exercise[];
  unit: Unit;
}

export default function WorkoutScreen({ exercises, unit }: Props) {
  const [view, setView] = useState<'today' | 'previous'>('today');
  const today = localDate();
  // The day being shown on the first tab: today, or a past day being filled in or edited.
  const [picked, setDay] = useState(today);
  const day = picked > today ? today : picked;
  const openDay = (d: string) => {
    setDay(d);
    setView('today');
  };

  return (
    <div className="stack">
      <div className="segmented" role="tablist" aria-label="Workouts">
        <button role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'seg active' : 'seg'} onClick={() => setView('today')}>
          {day === today ? 'Today' : formatDate(day)}
        </button>
        <button role="tab" aria-selected={view === 'previous'} className={view === 'previous' ? 'seg active' : 'seg'} onClick={() => setView('previous')}>
          Previous
        </button>
      </div>
      {view === 'today' ? (
        <>
          <DayPicker day={day} today={today} onChange={setDay} />
          <DayWorkout key={day} day={day} exercises={exercises} unit={unit} onMoved={setDay} />
        </>
      ) : (
        <PreviousWorkouts exercises={exercises} onRepeated={() => openDay(today)} onEdit={openDay} />
      )}
    </div>
  );
}

function nameMap(exercises: Exercise[]) {
  return new Map(exercises.map((e) => [e.id, e.name]));
}

function shiftDay(day: string, by: number) {
  const [y, m, d] = day.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + by, 12).getTime());
}

/** Choose which day to log: step back and forward, or pick a date. Future days aren't allowed. */
function DayPicker({ day, today, onChange }: { day: string; today: string; onChange: (d: string) => void }) {
  return (
    <div className="day-picker">
      <button className="secondary day-step" onClick={() => onChange(shiftDay(day, -1))} aria-label="Previous day">
        ‹
      </button>
      <input
        className="text-input day-input"
        type="date"
        value={day}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Workout day"
      />
      <button className="secondary day-step" onClick={() => onChange(shiftDay(day, 1))} disabled={day >= today} aria-label="Next day">
        ›
      </button>
      {day !== today && (
        <button className="link day-today" onClick={() => onChange(today)}>
          Back to today
        </button>
      )}
    </div>
  );
}

// ---------------- One day's workout ----------------

function DayWorkout({ day, exercises, unit, onMoved }: Props & { day: string; onMoved: (day: string) => void }) {
  const data = useLiveQuery(async () => {
    const workout = await getWorkoutByDate(day);
    const entries = workout ? await listWorkoutEntries(workout.id) : [];
    return { workout, entries };
  }, [day]);
  const [editing, setEditing] = useState(false);

  if (!data) return <p className="muted">Loading…</p>;
  if (!data.workout) return <StartWorkout day={day} exercises={exercises} />;
  if (editing) {
    return (
      <EditWorkout
        workout={data.workout}
        entries={data.entries}
        exercises={exercises}
        onDone={(movedTo) => {
          setEditing(false);
          if (movedTo) onMoved(movedTo);
        }}
      />
    );
  }
  return <ActiveWorkout key={data.workout.id} workout={data.workout} entries={data.entries} exercises={exercises} unit={unit} onEdit={() => setEditing(true)} />;
}

function StartWorkout({ day, exercises }: { day: string; exercises: Exercise[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recent = useLiveQuery(async () => {
    const ws = (await listWorkouts()).filter((w) => w.date !== day).slice(0, 5);
    const entries = await Promise.all(ws.map((w) => listWorkoutEntries(w.id)));
    return ws.map((w, i) => ({ w, entries: entries[i] }));
  }, [day]);
  const isToday = day === localDate();

  async function start() {
    try {
      await createWorkout({ exerciseIds: selected, name, date: day });
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
              Same exercises, pre-filled with that day's max weight and reps. Just update the numbers.
            </p>
          </div>
          {recent.map(({ w, entries }) => (
            <RepeatOption key={w.id} day={day} workout={w} entries={entries} exercises={exercises} onError={setError} />
          ))}
        </section>
      )}

      <section className="card stack">
        <div className="card-kicker">
          {recent && recent.length > 0
            ? 'Or build a new workout'
            : isToday
              ? `Start today's workout · ${formatDate(day)}`
              : `Add a workout for ${formatDate(day)}`}
        </div>
        <label className="field">
          <span className="label">Name (optional)</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
        </label>
        <span className="label">{isToday ? "Pick today's exercises" : 'Pick the exercises you did'}</span>
        <ExerciseChecklist exercises={exercises} selected={selected} onChange={setSelected} />
        {error && <div className="error" role="alert">{error}</div>}
        {/* Only float the button once something is picked, so it doesn't cover the Repeat options. */}
        <div className={selected.length > 0 ? 'sticky-action' : undefined}>
          <button className="primary full" disabled={selected.length === 0} onClick={start}>
            {selected.length === 0
              ? 'Pick at least one exercise'
              : `${isToday ? 'Start workout' : 'Add workout'} · ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </>
  );
}

/** One previous workout with a one-tap Repeat button. */
function RepeatOption({
  day,
  workout,
  entries,
  exercises,
  onError,
  onRepeated,
  replaceLogged,
}: {
  /** The day the repeat goes on. */
  day: string;
  workout: Workout;
  entries: Entry[];
  exercises: Exercise[];
  onError: (msg: string) => void;
  onRepeated?: () => void;
  /** If set, that day's workout already exists and will be replaced; the number of exercises logged in it. */
  replaceLogged?: number;
}) {
  const names = nameMap(exercises);
  const logged = new Map(entries.map((e) => [e.exerciseId, e]));
  const today = localDate();
  const items = workout.exerciseIds.filter((id) => names.has(id));

  async function repeat() {
    try {
      const which = day === localDate() ? "today's workout" : `the workout on ${formatDate(day)}`;
      if (replaceLogged && !confirm(`Replace ${which}? The ${replaceLogged} exercise${replaceLogged === 1 ? '' : 's'} logged in it will be removed.`)) return;
      await repeatWorkout(workout.id, day, undefined, replaceLogged !== undefined);
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
              {logged.has(id) && <span className="muted"> · {formatMaxSet(logged.get(id)!)}</span>}
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
  const [open, setOpen] = useState<string | null>(firstOpen);

  async function remove() {
    if (!confirm(`Delete the workout for ${workout.date === localDate() ? 'today' : formatDate(workout.date)} and the ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} logged in it?`)) return;
    await deleteWorkout(workout.id);
  }

  return (
    <>
      <section className="card workout-head">
        <div>
          <div className="card-kicker">{workout.date === localDate() ? `Today · ${formatDate(workout.date)}` : formatDate(workout.date)}</div>
          <div className="workout-title">{workout.name || (workout.date === localDate() ? "Today's workout" : 'Workout')}</div>
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
        {workout.date === localDate() ? "Delete today's workout" : 'Delete this workout'}
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
            Replaces this workout with the same exercises as the one you pick
            {logged > 0 ? `. The ${logged} exercise${logged === 1 ? '' : 's'} logged in it will be removed.` : '.'}
          </p>
          {recent.map(({ w, entries }) => (
            <RepeatOption key={w.id} day={workout.date} workout={w} entries={entries} exercises={exercises} onError={setError} replaceLogged={logged} />
          ))}
          {error && <div className="error" role="alert">{error}</div>}
        </>
      )}
    </section>
  );
}

function RepeatedFrom({ id }: { id: string }) {
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
  exerciseId: string;
  name: string;
  entry: Entry | undefined;
  unit: Unit;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  // What this exercise starts from: the repeated workout's max set, else the last time it was done.
  const last = useLiveQuery(async () => ({ e: await getStartingEntry(workout, exerciseId) }), [exerciseId, workout.id, workout.copiedFrom]);

  return (
    <section className={entry ? 'card wx done' : 'card wx'}>
      <button className="wx-head" onClick={onToggle} aria-expanded={open}>
        <span className={entry ? 'wx-num done' : 'wx-num'}>{entry ? '✓' : index + 1}</span>
        <span className="wx-main">
          <strong>{name}</strong>
          <span className="muted small">
            {entry
              ? formatMaxSet(entry)
              : last?.e
                ? `Last: ${formatMaxSet(last.e)} · ${relativeDay(last.e.date, workout.date)}`
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
      {open && <ExerciseHistory exerciseId={exerciseId} day={workout.date} unit={unit} />}
    </section>
  );
}

/** The History tab's chart for one exercise, up to the workout's day. */
function ExerciseHistory({ exerciseId, day, unit }: { exerciseId: string; day: string; unit: Unit }) {
  const entries = useLiveQuery(async () => (await listEntries(exerciseId)).filter((e) => e.date <= day), [exerciseId, day]);
  if (!entries || entries.length === 0) return null;
  return (
    <div className="wx-chart">
      <HistoryChart entries={entries} unit={unit} embedded />
    </div>
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
  exerciseId: string;
  entry: Entry | undefined;
  last: Entry | undefined;
  unit: Unit;
  onSaved: () => void;
}) {
  // Editing keeps the entry's own unit; a new entry uses the current setting, pre-filled from last time.
  const formUnit = entry?.unit ?? unit;
  const [rows, setRows] = useState<MaxSetInput>(() => maxSetFrom(entry ?? last, formUnit));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveWorkoutEntry(workout.id, exerciseId, { unit: formUnit, ...toMaxSet(rows), notes });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="stack wx-body" onSubmit={save}>
      <MaxSetEditor value={rows} onChange={setRows} unit={formUnit} />
      <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={!maxSetComplete(rows)}>
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
  /** Called when finished; with the new day if the workout was moved. */
  onDone: (movedTo?: string) => void;
}) {
  const names = nameMap(exercises);
  const [selected, setSelected] = useState<string[]>(workout.exerciseIds);
  const [name, setName] = useState(workout.name ?? '');
  const [date, setDate] = useState(workout.date);
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
      !confirm(`This removes what you logged for ${losing.map((e) => names.get(e.exerciseId)).join(', ')}. Continue?`)
    )
      return;
    try {
      await updateWorkout(workout.id, { exerciseIds: selected, name, date });
      onDone(date !== workout.date ? date : undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card stack">
      <div className="card-kicker">Edit workout</div>
      <label className="field">
        <span className="label">Name (optional)</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" />
      </label>
      <label className="field">
        <span className="label">Date</span>
        <input className="text-input" type="date" value={date} max={localDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
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
        <button className="secondary" onClick={() => onDone()}>
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

function PreviousWorkouts({
  exercises,
  onRepeated,
  onEdit,
}: {
  exercises: Exercise[];
  onRepeated: () => void;
  /** Opens that day's workout to edit it. */
  onEdit: (date: string) => void;
}) {
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
  if (data.items.length === 0) return <p className="muted center">No previous workouts yet. To add a past one, go back to the first tab and pick its date.</p>;

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
                      <div className="small">Max set: {formatMaxSet(e)}</div>
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
              <button className="secondary shrink" onClick={() => onEdit(w.date)}>
                Edit
              </button>
              <button
                className="link danger-text"
                onClick={async () => {
                  if (confirm(`Delete the workout from ${formatDate(w.date)} and what was logged in it?`)) await deleteWorkout(w.id);
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
