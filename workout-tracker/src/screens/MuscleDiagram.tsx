import { activationFor, type MuscleRegion } from '../muscleMap';
import type { ExerciseGuide } from '../exerciseGuide';

/*
 * A hand-drawn front and back body figure (original artwork). Each shape is drawn for the
 * figure's left half of a 100-wide box and mirrored for the right, so both sides match.
 */

/** Outline of half the body, from the top of the neck down the arm and leg to the crotch. */
const BODY_HALF =
  'M50,23 L45,23 L44,28 C40,29 35,30 31,32 C26,34 23,38 22,45 C21,52 21,60 20,70 ' +
  'C18,78 16,88 15,98 L13,108 C11,112 10,117 12,121 C14,123 17,121 18,117 L19,109 ' +
  'C22,99 25,88 27,78 C28,72 29,64 31,56 L33,63 C34,74 35,84 34,94 C32,101 30,108 30,118 ' +
  'C30,130 31,142 32,152 C30,162 30,174 32,186 L33,196 C30,199 29,202 31,204 L42,204 ' +
  'C44,202 44,198 43,194 C45,182 46,170 46,158 L47,150 C48,138 49,124 50,114 Z';

const HEAD = 'M50,3 C44.5,3 41.5,7.5 41.5,13 C41.5,18.5 45,23 50,23 C55,23 58.5,18.5 58.5,13 C58.5,7.5 55.5,3 50,3 Z';

type Shapes = Partial<Record<MuscleRegion, string[]>>;

const DELT_OUTER = 'M31,33.5 C26.5,35 24,38.5 23.5,44 C23.3,47 24,49 25.5,50 C26.5,45 28,40 31,35.5 Z';
const FOREARM = 'M21.5,73 C19.5,80 17.8,89 16.6,99 L18.6,100 C21,92 23.5,84 25.6,75 Z';

const FRONT: Shapes = {
  traps: ['M44.5,29 C41,30 37.5,31 34.5,32.3 L44.5,32.5 Z'],
  sideDelts: [DELT_OUTER],
  frontDelts: ['M32.5,34 C29.5,38 27.5,43 26.8,50 C29.5,48 31.5,44.5 34.5,39 L35,34 Z'],
  chest: ['M49,34.5 L36.5,34.5 L35.5,40 C34,44 33,48 34.5,51 C38.5,53.5 44.5,53.5 49,51.5 Z'],
  biceps: ['M27.5,52 C25.2,56 23.6,62 23.4,69.5 L26.8,70.5 C28.6,65 30,59 30.6,52.5 Z'],
  forearms: [FOREARM],
  abs: ['M49,54.5 L41.5,54.5 C40.8,66 41,80 43,94 C45,98 47,100 49,101 Z'],
  obliques: ['M39.8,55 L35.2,60 C36.2,70 36.8,80 36.3,89 C37.5,92 39.5,94 41.5,95 C39.5,82 39.2,68 39.8,55 Z'],
  quads: ['M33.5,108 C31.2,118 31,132 33,148 C36,150.5 41,150.5 44.5,148.5 C44.6,138 44.4,126 43.8,118 C41,113 37.5,110 33.5,108 Z'],
  adductors: ['M48,112 C46,114 44.9,117 45,121 C45.3,128 45.8,134 45.8,140 C47.6,132 48.8,123 49.2,114 Z'],
  calves: [
    'M32.8,157 C31.2,165 31.3,174 33.5,183 L35.6,183 C35.6,174 35.2,165 34.8,157 Z',
    'M44.6,157 C43.5,163 43,170 43.3,177 L44.5,177 C45.5,170 45.8,163 45.5,157 Z',
  ],
};

const BACK: Shapes = {
  traps: ['M49,24.5 L45,24.5 L44.5,28.5 C40.5,29.8 36.5,31 33.5,32.5 C37.5,34 42,36 49,40 Z'],
  sideDelts: [DELT_OUTER],
  rearDelts: ['M32.5,34 C29.5,38 27.5,43 26.8,50 C30,48 33,45 36.5,41 L35.5,35 Z'],
  upperBack: ['M49,41.5 C43,38.5 40,37 37.5,37.8 L38,43 C41,47 45,51 49,53.5 Z'],
  triceps: ['M25.5,52 C23.4,57 22.8,63 23.2,70 L27.4,70.6 C29.2,65 30.4,59 30.9,52.5 C29,53.5 27.2,53.2 25.5,52 Z'],
  forearms: [FOREARM],
  lats: ['M36.8,44 C34.6,49 34.4,56 35.6,64 C36.6,71 38.6,77 40.5,80 L46.5,73 L46.8,58 C43.5,54 40,49 36.8,44 Z'],
  lowerBack: ['M49,56 L48,58 L48,74.5 L42,81.5 C41.8,86 42.3,90 43,93.5 C45,94.3 47,94.6 49,94.6 Z'],
  glutes: ['M49,98 C44,97 39,96.5 35,98.5 C32,102 31.2,108 32.2,114 C36,119.5 43,120.5 49,117 Z'],
  hamstrings: ['M32.6,121 C31.6,132 32,142 33.8,150 C37,151.5 41.5,151.5 45,150 C46.3,140 47.3,130 48,122 C42.5,124.5 37,124 32.6,121 Z'],
  calves: [
    'M32.8,157 C30.8,165 31.3,175 35,182.5 C37,182 38.5,180.5 38.8,178 C39,170 38.8,163 38,157 Z',
    'M39.8,157 C39.6,164 40,171 41,178.5 C42.5,181 44,181.5 44.6,180 C45.8,172 46,164 45.4,157 Z',
  ],
};

const MIRROR = 'translate(100,0) scale(-1,1)';

function Figure({ shapes, x, label, active }: {
  shapes: Shapes;
  x: number;
  label: string;
  active: ReturnType<typeof activationFor>;
}) {
  return (
    <g transform={`translate(${x},0)`}>
      <path d={HEAD} className="md-body" />
      {[undefined, MIRROR].map((t) => (
        <g key={t ?? 'l'} transform={t}>
          <path d={BODY_HALF} className="md-body" />
          {(Object.entries(shapes) as [MuscleRegion, string[]][]).map(([region, ds]) =>
            ds.map((d, i) => (
              <path key={region + i} d={d} className={active.has(region) ? `md-muscle md-${active.get(region)}` : 'md-muscle'} data-region={region} />
            )),
          )}
        </g>
      ))}
      <text x={50} y={216} textAnchor="middle" className="md-label">
        {label}
      </text>
    </g>
  );
}

/** Front and back body figures with the exercise's main muscles in full colour and assisting ones lighter. */
export function MuscleDiagram({ guide }: { guide: Pick<ExerciseGuide, 'primary' | 'secondary'> }) {
  const active = activationFor(guide);
  const hasSecondary = [...active.values()].includes('secondary');
  return (
    <figure className="muscle-diagram">
      <svg viewBox="0 0 220 222" role="img" aria-label={`Body diagram highlighting: ${[...guide.primary, ...guide.secondary].join(', ')}`}>
        <Figure shapes={FRONT} x={2} label="Front" active={active} />
        <Figure shapes={BACK} x={118} label="Back" active={active} />
      </svg>
      <figcaption className="md-legend small muted">
        <span><i className="md-swatch md-primary" /> Main</span>
        {hasSecondary && <span><i className="md-swatch md-secondary" /> Assisting</span>}
      </figcaption>
    </figure>
  );
}
