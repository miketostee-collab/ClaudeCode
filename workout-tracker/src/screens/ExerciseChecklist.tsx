import { useState } from 'react';
import type { Exercise } from '../db';

interface Props {
  exercises: Exercise[];
  /** Selected ids in the order they will appear in the workout. */
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Searchable multi-select. Ticking an exercise appends it, so the numbers show workout order. */
export default function ExerciseChecklist({ exercises, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="stack checklist">
      <input
        className="text-input"
        type="search"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search exercises"
      />
      <ul className="plain-list check-list" role="group" aria-label="Exercises">
        {shown.map((ex) => {
          const pos = selected.indexOf(ex.id);
          return (
            <li key={ex.id}>
              <label className={pos >= 0 ? 'check-row on' : 'check-row'}>
                <input type="checkbox" checked={pos >= 0} onChange={() => toggle(ex.id)} />
                <span className="check-badge" aria-hidden>{pos >= 0 ? pos + 1 : ''}</span>
                <span>{ex.name}</span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="muted small">No exercises match. Add new ones on the Exercises tab.</li>}
      </ul>
    </div>
  );
}
