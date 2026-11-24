interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  min: number;
  decimal?: boolean;
  suffix?: string;
}

/** Number input with large +/- buttons for one-handed use at the gym. */
export default function Stepper({ label, value, onChange, step, min, decimal, suffix }: Props) {
  const bump = (dir: 1 | -1) => {
    const current = Number(value) || 0;
    const next = Math.max(min, Math.round((current + dir * step) * 100) / 100);
    onChange(String(next));
  };
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" className="step-btn" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
          −
        </button>
        <div className="step-input-wrap">
          <input
            className="step-input"
            inputMode={decimal ? 'decimal' : 'numeric'}
            pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(',', '.'))}
            onFocus={(e) => e.target.select()}
            aria-label={label}
          />
          {suffix && <span className="step-suffix">{suffix}</span>}
        </div>
        <button type="button" className="step-btn" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
