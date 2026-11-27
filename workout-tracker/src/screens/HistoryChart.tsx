import { useEffect, useRef, useState } from 'react';
import type { Entry, Unit } from '../db';
import { alignedIntScale, chartPoints, niceScale, shortDay } from '../chartData';
import { fmtNum, formatDate } from '../prefs';

const HEIGHT = 200;
const M = { top: 26, right: 34, bottom: 24, left: 38 };

/** Bar path with 4px rounded top corners, anchored to the baseline. */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Weight (left axis) and reps (right axis) per day, for the History tab. */
export default function HistoryChart({ entries, unit }: { entries: Entry[]; unit: Unit }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = chartPoints(entries, unit);
  useEffect(() => setActive(null), [pts.length, entries]);
  if (pts.length === 0) return null;

  const w = niceScale(Math.max(...pts.map((p) => p.weight)));
  const r = alignedIntScale(Math.max(...pts.map((p) => p.reps)), w.ticks.length - 1);
  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const gw = plotW / pts.length;
  const bw = Math.max(3, Math.min(16, (gw - 6) / 2 - 1));
  const yW = (v: number) => M.top + plotH - (v / w.max) * plotH;
  const yR = (v: number) => M.top + plotH - (v / r.max) * plotH;
  // Skip date labels so they don't collide (about 44px each).
  const every = Math.ceil(pts.length / Math.max(1, Math.floor(plotW / 44)));
  const shown = active != null ? pts[active] : pts[pts.length - 1];

  return (
    <section className="card chart-card" aria-label="Weight and reps by day">
      <div className="chart-head">
        <span className="chart-legend">
          <span className="swatch swatch-weight" /> Weight ({unit})
        </span>
        <span className="chart-legend">
          <span className="swatch swatch-reps" /> Reps
        </span>
      </div>
      <div className="chart-readout small" aria-live="polite">
        <strong>{formatDate(shown.date)}</strong>: {fmtNum(shown.weight)} {unit} × {shown.reps}
      </div>
      <div ref={wrap} className="chart-wrap">
        <svg width={width} height={HEIGHT} role="img" aria-label={`Weight and reps for the last ${pts.length} days logged`}>
          {w.ticks.map((t) => (
            <g key={'w' + t}>
              <line className="chart-grid" x1={M.left} x2={width - M.right} y1={yW(t)} y2={yW(t)} />
              <text className="chart-tick" x={M.left - 6} y={yW(t)} textAnchor="end" dominantBaseline="middle">{fmtNum(t)}</text>
            </g>
          ))}
          {r.ticks.map((t) => (
            <text key={'r' + t} className="chart-tick" x={width - M.right + 6} y={yR(t)} dominantBaseline="middle">{fmtNum(t)}</text>
          ))}
          <text className="chart-tick" x={M.left - 6} y={4} textAnchor="end" dominantBaseline="hanging">{unit}</text>
          <text className="chart-tick" x={width - M.right + 6} y={4} dominantBaseline="hanging">reps</text>
          {pts.map((p, i) => {
            const cx = M.left + gw * i + gw / 2;
            const dim = active != null && active !== i;
            return (
              <g key={p.date} opacity={dim ? 0.45 : 1}>
                {p.weight > 0 && <path className="bar-weight" d={bar(cx - 1 - bw, yW(p.weight), bw, yW(0) - yW(p.weight))} />}
                {p.reps > 0 && <path className="bar-reps" d={bar(cx + 1, yR(p.reps), bw, yR(0) - yR(p.reps))} />}
                {(pts.length - 1 - i) % every === 0 && (
                  <text className="chart-tick" x={cx} y={HEIGHT - 6} textAnchor="middle">{shortDay(p.date)}</text>
                )}
                <rect
                  x={M.left + gw * i}
                  y={0}
                  width={gw}
                  height={HEIGHT}
                  fill="transparent"
                  onPointerEnter={(ev) => ev.pointerType === 'mouse' && setActive(i)}
                  onPointerLeave={(ev) => ev.pointerType === 'mouse' && setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                >
                  <title>{`${formatDate(p.date)}: ${fmtNum(p.weight)} ${unit} × ${p.reps}`}</title>
                </rect>
              </g>
            );
          })}
          <line className="chart-axis" x1={M.left} x2={width - M.right} y1={yW(0)} y2={yW(0)} />
        </svg>
      </div>
      {pts.length > 1 && <div className="muted small">Heaviest set each day, last {pts.length} days logged. Tap a day for its numbers.</div>}
    </section>
  );
}
