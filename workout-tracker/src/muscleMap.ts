import type { ExerciseGuide } from './exerciseGuide';

/** The muscle areas the body diagram can light up (see screens/MuscleDiagram.tsx). */
export type MuscleRegion =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'rotatorCuff'
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
  | 'calves'
  | 'tibialis';

interface Rule {
  test: RegExp;
  regions: MuscleRegion[];
  /** The anatomical name shown under the diagram. */
  name: string;
}

/**
 * Rules turning a guide's muscle text ("Front shoulders (anterior deltoids)") into diagram
 * regions and an anatomical name. The first matching rule wins, so specific ones come first.
 */
const RULES: Rule[] = [
  { test: /serratus/, regions: ['obliques'], name: 'Serratus anterior' },
  { test: /^shoulders.*mainly front/, regions: ['frontDelts', 'sideDelts'], name: 'Deltoid (anterior and lateral heads)' },
  { test: /^shoulders/, regions: ['frontDelts', 'sideDelts', 'rearDelts'], name: 'Deltoid' },
  { test: /front shoulder|anterior delt/, regions: ['frontDelts'], name: 'Anterior deltoid' },
  { test: /side shoulder|lateral delt/, regions: ['sideDelts'], name: 'Lateral deltoid' },
  { test: /rear shoulder|posterior delt/, regions: ['rearDelts'], name: 'Posterior deltoid' },
  { test: /rotator cuff/, regions: ['rotatorCuff'], name: 'Rotator cuff (infraspinatus, teres minor)' },
  { test: /upper back and traps/, regions: ['upperBack', 'traps'], name: 'Trapezius and rhomboids' },
  { test: /upper back.*(rhomboid|trap)/, regions: ['upperBack'], name: 'Rhomboids and middle trapezius' },
  { test: /upper back/, regions: ['upperBack'], name: 'Rhomboids, trapezius and teres major' },
  { test: /trap/, regions: ['traps'], name: 'Upper trapezius' },
  { test: /upper chest/, regions: ['chest'], name: 'Pectoralis major (clavicular head)' },
  { test: /lower chest/, regions: ['chest'], name: 'Pectoralis major (lower sternal head)' },
  { test: /chest|pectoral/, regions: ['chest'], name: 'Pectoralis major' },
  { test: /biceps/, regions: ['biceps'], name: 'Biceps brachii' },
  { test: /^brachialis/, regions: ['biceps'], name: 'Brachialis' },
  { test: /brachioradialis/, regions: ['forearms'], name: 'Brachioradialis' },
  { test: /forearm|grip/, regions: ['forearms'], name: 'Forearm flexors' },
  { test: /triceps/, regions: ['triceps'], name: 'Triceps brachii' },
  { test: /lats|latissimus/, regions: ['lats'], name: 'Latissimus dorsi' },
  { test: /lower back|erector/, regions: ['lowerBack'], name: 'Erector spinae' },
  { test: /oblique/, regions: ['abs', 'obliques'], name: 'Rectus abdominis and obliques' },
  { test: /core|abs\b|abdominal/, regions: ['abs'], name: 'Rectus abdominis' },
  { test: /glute/, regions: ['glutes'], name: 'Gluteus maximus' },
  { test: /hamstring/, regions: ['hamstrings'], name: 'Hamstrings (biceps femoris, semitendinosus, semimembranosus)' },
  { test: /quad/, regions: ['quads'], name: 'Quadriceps femoris' },
  { test: /adductor/, regions: ['adductors'], name: 'Adductors (adductor longus, magnus, gracilis)' },
  { test: /ankle/, regions: ['tibialis', 'calves'], name: 'Tibialis anterior and ankle stabilisers' },
  { test: /cal(f|ves)/, regions: ['calves'], name: 'Gastrocnemius and soleus' },
];

function ruleFor(muscle: string): Rule | undefined {
  const m = muscle.toLowerCase().trim();
  return RULES.find((r) => r.test.test(m));
}

/** The diagram regions for one muscle as written in a guide (empty if none match). */
export function muscleRegions(muscle: string): MuscleRegion[] {
  return ruleFor(muscle)?.regions ?? [];
}

/** The anatomical name for one muscle as written in a guide (the text itself if no rule matches). */
export function anatomicalName(muscle: string): string {
  return ruleFor(muscle)?.name ?? muscle;
}

export type Activation = 'primary' | 'secondary';

/** Which regions an exercise works; a region that is both primary and secondary counts as primary. */
export function activationFor(guide: Pick<ExerciseGuide, 'primary' | 'secondary'>): Map<MuscleRegion, Activation> {
  const out = new Map<MuscleRegion, Activation>();
  for (const m of guide.secondary) for (const r of muscleRegions(m)) out.set(r, 'secondary');
  for (const m of guide.primary) for (const r of muscleRegions(m)) out.set(r, 'primary');
  return out;
}

/** Anatomical names of an exercise's primary and secondary muscles, without repeats. */
export function anatomicalNames(guide: Pick<ExerciseGuide, 'primary' | 'secondary'>): {
  primary: string[];
  secondary: string[];
} {
  const primary = [...new Set(guide.primary.map(anatomicalName))];
  const secondary = [...new Set(guide.secondary.map(anatomicalName))].filter((n) => !primary.includes(n));
  return { primary, secondary };
}
