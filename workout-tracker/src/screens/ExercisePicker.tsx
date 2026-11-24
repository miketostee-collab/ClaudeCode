import type { Exercise } from '../db';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: string | null) => void;
}

export default function ExercisePicker({ exercises, selected, onSelect }: Props) {
  return (
    <label className="field">
      <span className="label">Exercise</span>
      <select
        className="select"
        value={selected?.id ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Choose an exercise…</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
    </label>
  );
}
