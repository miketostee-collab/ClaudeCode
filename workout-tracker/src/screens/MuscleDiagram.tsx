import { BACK_PATHS, FRONT_PATHS } from '../anatomyPaths';
import { activationFor, anatomicalNames, type Activation, type MuscleRegion } from '../muscleMap';
import type { ExerciseGuide } from '../exerciseGuide';

/*
 * Front and back anatomical figures (artwork from react-native-body-highlighter, MIT; see
 * src/anatomyPaths.ts). Each drawing group in anatomyPaths lights up when one of the regions
 * listed for it here is worked.
 */

/** For each drawing group, the regions that light it, per view. */
const FRONT_GROUPS: Record<string, MuscleRegion[]> = {
  chest: ['chest'],
  frontDelts: ['frontDelts', 'sideDelts'],
  traps: ['traps'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  abs: ['abs'],
  obliques: ['obliques'],
  quads: ['quads'],
  adductors: ['adductors'],
  calves: ['calves'],
  tibialis: ['tibialis'],
  neck: [],
};

const BACK_GROUPS: Record<string, MuscleRegion[]> = {
  traps: ['traps', 'upperBack'],
  rearDelts: ['rearDelts', 'sideDelts'],
  rotatorCuff: ['rotatorCuff'],
  teres: ['upperBack'],
  lats: ['lats'],
  lowerBack: ['lowerBack'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  glutes: ['glutes'],
  hamstrings: ['hamstrings'],
  adductors: ['adductors'],
  calves: ['calves'],
  neck: [],
};

function groupActivation(regions: MuscleRegion[], active: Map<MuscleRegion, Activation>): Activation | undefined {
  const states = regions.map((r) => active.get(r));
  return states.includes('primary') ? 'primary' : states.includes('secondary') ? 'secondary' : undefined;
}

function Figure({ paths, groups, viewBox, label, active }: {
  paths: Record<string, string[]>;
  groups: Record<string, MuscleRegion[]>;
  viewBox: string;
  label: string;
  active: Map<MuscleRegion, Activation>;
}) {
  return (
    <figure className="md-figure">
      <svg viewBox={viewBox} aria-hidden="true">
        {Object.entries(paths).map(([group, ds]) => {
          const state = group === 'body' ? undefined : groupActivation(groups[group] ?? [], active);
          const cls = group === 'body' ? 'md-body' : state ? `md-muscle md-${state}` : 'md-muscle';
          return ds.map((d, i) => <path key={group + i} d={d} className={cls} data-group={group} />);
        })}
      </svg>
      <figcaption className="md-label">{label}</figcaption>
    </figure>
  );
}

/** Anterior and posterior views with the exercise's primary muscles in red and secondary ones lighter. */
export function MuscleDiagram({ guide }: { guide: Pick<ExerciseGuide, 'primary' | 'secondary'> }) {
  const active = activationFor(guide);
  const names = anatomicalNames(guide);
  return (
    <div className="muscle-diagram">
      <div className="md-figures" role="img" aria-label={`Muscle diagram. Primary: ${names.primary.join(', ')}.${names.secondary.length ? ` Secondary: ${names.secondary.join(', ')}.` : ''}`}>
        <Figure paths={FRONT_PATHS} groups={FRONT_GROUPS} viewBox="43 86 642 1266" label="Anterior" active={active} />
        <Figure paths={BACK_PATHS} groups={BACK_GROUPS} viewBox="763 86 642 1266" label="Posterior" active={active} />
      </div>
      <dl className="md-key small">
        <div>
          <dt><i className="md-swatch md-primary" /> Primary</dt>
          <dd>{names.primary.join(' · ')}</dd>
        </div>
        {names.secondary.length > 0 && (
          <div>
            <dt><i className="md-swatch md-secondary" /> Secondary</dt>
            <dd>{names.secondary.join(' · ')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
