import type { ExerciseGuide } from './exerciseGuide';

/** The areas drawn on the body diagram (see screens/MuscleDiagram.tsx). */
export type MuscleRegion =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'traps'
  | 'upperBack'
  | 'lats'
  | 'lowerBack'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'calves';

/**
 * Rules turning a guide's muscle text ("Front shoulders (anterior deltoids)") into diagram
 * regions. The first matching rule wins, so specific ones come first.
 */
const RULES: [RegExp, MuscleRegion[]][] = [
  [/serratus/, ['obliques']],
  [/^shoulders.*mainly front/, ['frontDelts', 'sideDelts']],
  [/^shoulders/, ['frontDelts', 'sideDelts', 'rearDelts']],
  [/front shoulder|anterior delt/, ['frontDelts']],
  [/side shoulder|lateral delt/, ['sideDelts']],
  [/rear shoulder|posterior delt|rotator cuff/, ['rearDelts']],
  [/upper back and traps/, ['upperBack', 'traps']],
  [/upper back|rhomboid/, ['upperBack']],
  [/trap/, ['traps']],
  [/chest|pectoral/, ['chest']],
  [/biceps|^brachialis/, ['biceps']],
  [/forearm|brachioradialis|grip/, ['forearms']],
  [/triceps/, ['triceps']],
  [/lats|latissimus/, ['lats']],
  [/lower back|erector/, ['lowerBack']],
  [/oblique/, ['abs', 'obliques']],
  [/core|abs\b|abdominal/, ['abs']],
  [/glute/, ['glutes']],
  [/hamstring/, ['hamstrings']],
  [/quad/, ['quads']],
  [/adductor/, ['adductors']],
  [/cal(f|ves)|ankle/, ['calves']],
];

/** The diagram regions for one muscle as written in a guide (empty if none match). */
export function muscleRegions(muscle: string): MuscleRegion[] {
  const m = muscle.toLowerCase().trim();
  return RULES.find(([re]) => re.test(m))?.[1] ?? [];
}

export type Activation = 'primary' | 'secondary';

/** Which regions an exercise works; a region that is both primary and secondary counts as primary. */
export function activationFor(guide: Pick<ExerciseGuide, 'primary' | 'secondary'>): Map<MuscleRegion, Activation> {
  const out = new Map<MuscleRegion, Activation>();
  for (const m of guide.secondary) for (const r of muscleRegions(m)) out.set(r, 'secondary');
  for (const m of guide.primary) for (const r of muscleRegions(m)) out.set(r, 'primary');
  return out;
}
