import type { Entry, Unit } from '../db';
import { convertWeight, fmtNum } from '../prefs';

/** The max set as typed: strings, so a half-typed number isn't lost. */
export interface MaxSetInput {
  weight: string;
  reps: string;
}

export const EMPTY_MAX_SET: MaxSetInput = { weight: '', reps: '' };

/** Pre-fills from an entry, converting its weight to the given unit. */
export function maxSetFrom(entry: Entry | undefined, unit: Unit): MaxSetInput {
  if (!entry) return EMPTY_MAX_SET;
  return { weight: fmtNum(convertWeight(entry.weight, entry.unit, unit)), reps: String(entry.reps) };
}

export function toMaxSet(v: MaxSetInput) {
  return { weight: Number(v.weight), reps: Number(v.reps) };
}

export function maxSetComplete(v: MaxSetInput) {
  return v.weight !== '' && v.reps !== '';
}

/** Two fields: the heaviest weight lifted, and the reps done at it. */
export default function MaxSetEditor({
  value,
  onChange,
  unit,
}: {
  value: MaxSetInput;
  onChange: (v: MaxSetInput) => void;
  unit: Unit;
}) {
  return (
    <div className="max-set">
      <label className="field">
        <span className="label">Max weight ({unit})</span>
        <input
          className="set-input"
          inputMode="decimal"
          value={value.weight}
          onChange={(e) => onChange({ ...value, weight: e.target.value.replace(',', '.') })}
          onFocus={(e) => e.target.select()}
          placeholder="0"
        />
      </label>
      <span className="times" aria-hidden>×</span>
      <label className="field">
        <span className="label">Reps</span>
        <input
          className="set-input"
          inputMode="numeric"
          value={value.reps}
          onChange={(e) => onChange({ ...value, reps: e.target.value })}
          onFocus={(e) => e.target.select()}
          placeholder="0"
        />
      </label>
    </div>
  );
}
