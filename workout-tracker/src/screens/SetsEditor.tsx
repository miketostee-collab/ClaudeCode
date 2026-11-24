import { MAX_SETS, type Unit } from '../db';

export interface SetRow {
  weight: string;
  reps: string;
}

interface Props {
  rows: SetRow[];
  onChange: (rows: SetRow[]) => void;
  unit: Unit;
}

/** Editable list of sets, each with its own weight and reps. */
export default function SetsEditor({ rows, onChange, unit }: Props) {
  const update = (i: number, patch: Partial<SetRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  // A new set starts as a copy of the previous one, which is usually close.
  const add = () => onChange([...rows, rows[rows.length - 1] ?? { weight: '', reps: '' }]);

  return (
    <div className="sets-editor">
      <div className="set-grid set-grid-head" aria-hidden>
        <span />
        <span>Weight ({unit})</span>
        <span />
        <span>Reps</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="set-grid">
          <span className="set-label">Set {i + 1}</span>
          <input
            className="set-input"
            inputMode="decimal"
            value={r.weight}
            onChange={(e) => update(i, { weight: e.target.value.replace(',', '.') })}
            onFocus={(e) => e.target.select()}
            aria-label={`Set ${i + 1} weight`}
            placeholder="0"
          />
          <span className="times" aria-hidden>×</span>
          <input
            className="set-input"
            inputMode="numeric"
            value={r.reps}
            onChange={(e) => update(i, { reps: e.target.value })}
            onFocus={(e) => e.target.select()}
            aria-label={`Set ${i + 1} reps`}
            placeholder="0"
          />
          {rows.length > 1 ? (
            <button type="button" className="set-remove" onClick={() => remove(i)} aria-label={`Remove set ${i + 1}`}>
              ✕
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {rows.length < MAX_SETS && (
        <button type="button" className="secondary add-set" onClick={add}>
          + Add set
        </button>
      )}
    </div>
  );
}

export function rowsToSets(rows: SetRow[]) {
  return rows.map((r) => ({ weight: Number(r.weight), reps: Number(r.reps) }));
}

export function rowsComplete(rows: SetRow[]) {
  return rows.length > 0 && rows.every((r) => r.weight !== '' && r.reps !== '');
}
