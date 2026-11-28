import { DEFAULT_EXERCISES, defaultExerciseId, type Exercise } from './db';

/** Reference information shown when you open an exercise on the Exercises tab. */
export interface ExerciseGuide {
  /** What the exercise is, in a sentence or two. */
  summary: string;
  equipment: string;
  /** Muscles doing most of the work. */
  primary: string[];
  /** Muscles that assist or stabilise. */
  secondary: string[];
  /** How to do one rep, in order. */
  steps: string[];
  /** Common mistakes and cues. */
  tips: string[];
}

/** Guides for the built-in exercises, keyed by their name in DEFAULT_EXERCISES. */
export const GUIDES: Record<string, ExerciseGuide> = {
  'Bench Press': {
    summary: 'A flat barbell press lying on a bench. The main upper-body pushing lift for chest strength and size.',
    equipment: 'Barbell, flat bench, rack',
    primary: ['Chest (pectoralis major)'],
    secondary: ['Front shoulders (anterior deltoids)', 'Triceps'],
    steps: [
      'Lie on the bench with your eyes under the bar and feet flat on the floor.',
      'Grip the bar slightly wider than shoulder width. Squeeze your shoulder blades together and down.',
      'Unrack the bar and hold it over your shoulders with straight arms.',
      'Lower it under control to your mid-chest, elbows about 45° from your body.',
      'Press back up to straight arms, keeping your back and feet set.',
    ],
    tips: [
      "Keep your bum on the bench and don't bounce the bar off your chest.",
      'Keep your wrists stacked over your elbows.',
      'Use a spotter or safety pins when going heavy.',
    ],
  },
  Squat: {
    summary: 'A barbell back squat: the main lower-body strength lift.',
    equipment: 'Barbell, squat rack',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Adductors', 'Hamstrings', 'Lower back (erectors)', 'Core'],
    steps: [
      'Set the bar on your upper back (not your neck) and grip it just outside your shoulders.',
      'Unrack it and step back. Feet about shoulder width apart, toes turned out slightly.',
      'Brace your core with a deep breath.',
      'Sit down and back, pushing your knees out in line with your toes, until your hips are at least level with your knees.',
      'Drive up through your whole foot to standing, keeping your chest up.',
    ],
    tips: [
      "Don't let your knees cave inwards.",
      'Keep your heels down throughout.',
      'Set safety bars just below the bottom of your squat.',
    ],
  },
  Deadlift: {
    summary: 'Lifting a loaded barbell from the floor to standing. Works the whole back of the body.',
    equipment: 'Barbell, plates',
    primary: ['Glutes', 'Hamstrings', 'Lower back (erectors)'],
    secondary: ['Quadriceps', 'Upper back and traps', 'Forearms (grip)', 'Core'],
    steps: [
      'Stand with your mid-foot under the bar, feet about hip width apart.',
      'Hinge down and grip the bar just outside your legs.',
      'Bend your knees until your shins touch the bar. Lift your chest and flatten your back.',
      'Brace, then push the floor away, keeping the bar against your legs.',
      'Stand tall with your hips and knees locked out, then lower the bar the same way.',
    ],
    tips: [
      "Keep your back flat. Don't round it to reach the bar.",
      "Don't lean back at the top.",
      'Keep the bar close to your body all the way up and down.',
    ],
  },
  'Overhead Press': {
    summary: 'A standing barbell press from the shoulders to overhead.',
    equipment: 'Barbell, rack',
    primary: ['Shoulders (deltoids, mainly front)'],
    secondary: ['Triceps', 'Upper chest', 'Upper back and traps', 'Core'],
    steps: [
      'Hold the bar at your collarbones with hands just outside your shoulders, elbows slightly in front of the bar.',
      'Stand with feet hip width apart. Squeeze your glutes and brace your core.',
      'Press the bar straight up, moving your head back slightly to let it pass.',
      'Lock out overhead with the bar over your mid-foot, head through your arms.',
      'Lower under control to your collarbones.',
    ],
    tips: [
      "Don't lean back or arch your lower back to push the weight up.",
      'Keep your forearms vertical.',
    ],
  },
  'Barbell Row': {
    summary: 'A bent-over row pulling a barbell to your lower chest. Builds a thick, strong upper back.',
    equipment: 'Barbell',
    primary: ['Lats', 'Upper back (rhomboids, middle traps)'],
    secondary: ['Rear shoulders', 'Biceps', 'Lower back (holding position)'],
    steps: [
      'Hold the bar with an overhand grip, hands just wider than shoulder width.',
      'Hinge at the hips until your torso is roughly 30–45° above horizontal, knees slightly bent, back flat.',
      'Let the bar hang at arm’s length.',
      'Pull it to your lower chest or upper stomach, driving your elbows back.',
      'Lower under control without standing up.',
    ],
    tips: [
      "Don't jerk the weight up with your hips.",
      'Squeeze your shoulder blades together at the top.',
    ],
  },
  'Pull-up': {
    summary: 'Hanging from a bar with an overhand grip and pulling your chin over it.',
    equipment: 'Pull-up bar (add weight with a belt if needed)',
    primary: ['Lats'],
    secondary: ['Biceps', 'Upper back (rhomboids, traps)', 'Rear shoulders', 'Forearms (grip)', 'Core'],
    steps: [
      'Hang from the bar with palms facing away, hands a bit wider than shoulder width.',
      'Pull your shoulders down and back to start.',
      'Pull yourself up, driving your elbows down towards your ribs, until your chin clears the bar.',
      'Lower to straight arms under control.',
    ],
    tips: [
      "Avoid swinging or kicking. Each rep should be strict.",
      'Use a band or the assisted machine if you can’t do the reps yet.',
      'For this app, log any added weight (or 0 for bodyweight).',
    ],
  },
  'Lat Pulldown': {
    summary: 'A seated cable pull from overhead to your upper chest. Works the same muscles as a pull-up, with adjustable weight.',
    equipment: 'Lat pulldown machine',
    primary: ['Lats'],
    secondary: ['Biceps', 'Upper back (rhomboids, traps)', 'Rear shoulders'],
    steps: [
      'Set the thigh pad so your legs are locked in.',
      'Grip the bar a bit wider than shoulder width, palms facing away.',
      'Lean back slightly and pull the bar to your upper chest, driving your elbows down.',
      'Pause, then let it rise until your arms are straight.',
    ],
    tips: ["Don't pull behind your neck.", "Don't use your body weight to yank it down."],
  },
  'Bicep Curl': {
    summary: 'Curling a barbell or dumbbells from your thighs to your shoulders.',
    equipment: 'Barbell, EZ bar or dumbbells',
    primary: ['Biceps'],
    secondary: ['Forearms (brachialis, brachioradialis)'],
    steps: [
      'Stand tall holding the weight with palms facing forward, arms straight.',
      'Keep your elbows pinned to your sides.',
      'Curl the weight up until your forearms are vertical.',
      'Squeeze, then lower slowly to straight arms.',
    ],
    tips: ["Don't swing your body or let your elbows drift forward.", 'Control the lowering. It does as much work as the lift.'],
  },
  'Tricep Pushdown': {
    summary: 'Pushing a cable attachment down from chest height to straight arms.',
    equipment: 'Cable machine with a rope or straight bar',
    primary: ['Triceps'],
    secondary: [],
    steps: [
      'Stand facing a high pulley and grip the attachment, elbows at your sides.',
      'Keeping your upper arms still, push down until your arms are straight.',
      'Squeeze, then let your forearms rise to just above parallel.',
    ],
    tips: ["Don't let your elbows flare or move forward.", "Stand tall rather than leaning over the weight."],
  },
  'Leg Press': {
    summary: 'A machine press with your feet on a sled. Heavy leg work without a bar on your back.',
    equipment: 'Leg press machine',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Hamstrings', 'Adductors'],
    steps: [
      'Sit with your back and hips flat against the pad.',
      'Place your feet shoulder width apart in the middle of the platform.',
      'Release the safeties and lower the sled until your knees are at about 90°.',
      'Press back up without locking your knees hard.',
    ],
    tips: [
      "Don't let your lower back lift off the pad at the bottom.",
      'Keep your knees in line with your toes.',
    ],
  },
  'Incline Bench Press': {
    summary: 'A barbell press on a bench set to about 30°. Puts more work on the upper chest and shoulders.',
    equipment: 'Barbell, incline bench, rack',
    primary: ['Upper chest (clavicular pectoralis)'],
    secondary: ['Front shoulders', 'Triceps'],
    steps: [
      'Set the bench to about 30° and lie back with your eyes under the bar.',
      'Grip slightly wider than shoulder width and set your shoulder blades back and down.',
      'Unrack and lower the bar to your upper chest, just below your collarbones.',
      'Press back up over your shoulders.',
    ],
    tips: ['A steeper bench turns it into a shoulder press. 30° is plenty.', 'Keep your feet planted and bum on the bench.'],
  },
  'Dumbbell Bench Press': {
    summary: 'A flat bench press with a dumbbell in each hand. Gives a longer range of motion and works each side on its own.',
    equipment: 'Dumbbells, flat bench',
    primary: ['Chest'],
    secondary: ['Front shoulders', 'Triceps'],
    steps: [
      'Sit with the dumbbells on your thighs, then lie back and bring them to your chest.',
      'Press them up over your chest, palms facing forward or slightly in.',
      'Lower until the dumbbells are beside your chest, elbows about 45° from your body.',
      'Press back up, bringing them together over your chest.',
    ],
    tips: ['Log the weight of one dumbbell.', 'Control the bottom. Don’t let them drop past a comfortable stretch.'],
  },
  'Chest Fly': {
    summary: 'Opening your arms wide and bringing them together in a hugging motion. Isolates the chest.',
    equipment: 'Dumbbells and bench, cable machine, or pec-deck machine',
    primary: ['Chest'],
    secondary: ['Front shoulders'],
    steps: [
      'Hold the handles or dumbbells over your chest with a slight bend in your elbows.',
      'Open your arms out to the sides in a wide arc until you feel a stretch across your chest.',
      'Bring them back together over your chest, keeping the same elbow bend.',
    ],
    tips: ["Don't turn it into a press by bending your elbows more.", 'Use a lighter weight than for presses.'],
  },
  Dips: {
    summary: 'Lowering and pressing your body between parallel bars.',
    equipment: 'Dip bars (add weight with a belt if needed)',
    primary: ['Triceps', 'Lower chest'],
    secondary: ['Front shoulders'],
    steps: [
      'Support yourself on the bars with straight arms.',
      'Lower by bending your elbows until your upper arms are about parallel to the floor.',
      'Press back up to straight arms.',
    ],
    tips: [
      'Lean forward slightly for more chest, stay upright for more triceps.',
      "Don't drop lower than your shoulders comfortably allow.",
      'Log any added weight (or 0 for bodyweight).',
    ],
  },
  'Dumbbell Shoulder Press': {
    summary: 'Pressing a dumbbell in each hand from your shoulders to overhead, seated or standing.',
    equipment: 'Dumbbells, bench with back support (optional)',
    primary: ['Shoulders (deltoids)'],
    secondary: ['Triceps', 'Upper chest', 'Traps'],
    steps: [
      'Hold the dumbbells at shoulder height, palms facing forward.',
      'Brace your core and press them overhead until your arms are straight.',
      'Lower back to shoulder height under control.',
    ],
    tips: ['Log the weight of one dumbbell.', "Don't arch your lower back. Use the back support if seated."],
  },
  'Lateral Raise': {
    summary: 'Raising dumbbells out to your sides. Isolates the side of the shoulders.',
    equipment: 'Dumbbells or cable',
    primary: ['Side shoulders (lateral deltoids)'],
    secondary: ['Traps'],
    steps: [
      'Stand holding dumbbells at your sides with a slight bend in your elbows.',
      'Raise them out to the sides until your arms are about level with your shoulders.',
      'Pause, then lower slowly.',
    ],
    tips: ['Lead with your elbows, not your hands.', "Use a light weight. Swinging takes the work off the shoulders.", 'Log the weight of one dumbbell.'],
  },
  'Face Pull': {
    summary: 'Pulling a rope attachment towards your face with elbows high. Good for the rear shoulders and shoulder health.',
    equipment: 'Cable machine with a rope',
    primary: ['Rear shoulders (posterior deltoids)', 'Upper back (rhomboids, middle traps)'],
    secondary: ['Rotator cuff'],
    steps: [
      'Set the pulley at about face height and grip the rope with palms facing down or in.',
      'Step back until your arms are straight.',
      'Pull the rope towards your face, separating the ends and driving your elbows out and back.',
      'Finish with your hands beside your ears, then return under control.',
    ],
    tips: ['Keep your elbows high, at or above shoulder level.', 'Use a light weight and squeeze at the end.'],
  },
  Shrugs: {
    summary: 'Lifting your shoulders straight up towards your ears while holding a weight.',
    equipment: 'Barbell or dumbbells',
    primary: ['Upper traps'],
    secondary: ['Forearms (grip)'],
    steps: [
      'Stand holding the weight at arm’s length.',
      'Lift your shoulders straight up as high as you can.',
      'Pause at the top, then lower slowly.',
    ],
    tips: ["Don't roll your shoulders. Straight up and down is enough.", "Keep your arms straight. Don't curl the weight."],
  },
  'Front Squat': {
    summary: 'A squat with the bar resting on the front of your shoulders. Keeps you more upright and puts more work on the quads.',
    equipment: 'Barbell, squat rack',
    primary: ['Quadriceps'],
    secondary: ['Glutes', 'Upper back', 'Core'],
    steps: [
      'Rest the bar on the front of your shoulders, close to your neck. Use a front-rack grip with fingertips under the bar, or cross your arms.',
      'Lift your elbows high so your upper arms are near parallel to the floor.',
      'Brace and squat straight down, keeping your torso upright and elbows up.',
      'Drive back up to standing.',
    ],
    tips: ['If your elbows drop, the bar will roll forward.', 'Wrist flexibility helps. Straps on the bar can stand in for the front-rack grip.'],
  },
  'Romanian Deadlift': {
    summary: 'A hip hinge with only a small knee bend, lowering the bar down your legs. Targets the hamstrings.',
    equipment: 'Barbell or dumbbells',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Lower back (erectors)', 'Forearms (grip)'],
    steps: [
      'Stand holding the bar at your hips with a shoulder-width grip.',
      'Soften your knees slightly and keep them there.',
      'Push your hips back and lower the bar down your thighs, keeping your back flat.',
      'Stop when you feel a strong stretch in your hamstrings, usually around mid-shin.',
      'Drive your hips forward to stand back up.',
    ],
    tips: ['Keep the bar touching your legs.', "It's a hinge, not a squat. Your knees barely bend."],
  },
  Lunges: {
    summary: 'Stepping into a split stance and lowering your back knee towards the floor, one leg at a time.',
    equipment: 'Bodyweight, dumbbells or barbell',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Hamstrings', 'Adductors', 'Calves', 'Core (balance)'],
    steps: [
      'Stand tall, holding weights if using them.',
      'Step forward with one leg.',
      'Lower until both knees are at about 90° and your back knee is just above the floor.',
      'Push through your front foot to step back, then switch legs.',
    ],
    tips: ['Keep your front knee over your foot, not caving in.', 'Take a long enough step that your front heel stays down.'],
  },
  'Hip Thrust': {
    summary: 'Driving your hips up with your upper back on a bench and a weight across your hips. The most direct glute builder.',
    equipment: 'Barbell with a pad, bench (or machine)',
    primary: ['Glutes'],
    secondary: ['Hamstrings', 'Quadriceps', 'Adductors'],
    steps: [
      'Sit on the floor with your upper back against the edge of a bench and the padded bar over your hips.',
      'Plant your feet about hip width apart, knees bent.',
      'Drive through your heels to lift your hips until your body is straight from shoulders to knees.',
      'Squeeze your glutes at the top, then lower under control.',
    ],
    tips: ['Tuck your chin and keep your ribs down so you don’t arch your lower back.', 'At the top your shins should be about vertical.'],
  },
  'Leg Extension': {
    summary: 'A seated machine movement straightening your knees against a pad. Isolates the quads.',
    equipment: 'Leg extension machine',
    primary: ['Quadriceps'],
    secondary: [],
    steps: [
      'Sit with your back against the pad and the roller on your lower shins.',
      'Line your knees up with the machine’s pivot.',
      'Straighten your legs until they’re fully extended.',
      'Squeeze, then lower under control.',
    ],
    tips: ["Don't kick the weight up with momentum.", 'Hold the handles to keep your hips down.'],
  },
  'Leg Curl': {
    summary: 'A machine movement bending your knees against a pad, lying or seated. Isolates the hamstrings.',
    equipment: 'Lying or seated leg curl machine',
    primary: ['Hamstrings'],
    secondary: ['Calves'],
    steps: [
      'Set up with the pad just above your heels and your knees lined up with the pivot.',
      'Curl your heels towards your bum as far as you can.',
      'Squeeze, then lower slowly to almost straight.',
    ],
    tips: ["Keep your hips down. Don't lift them to help the weight.", 'Control the lowering.'],
  },
  'Calf Raise': {
    summary: 'Rising up onto your toes. Works the calves.',
    equipment: 'Calf raise machine, step with dumbbells, or leg press',
    primary: ['Calves (gastrocnemius, soleus)'],
    secondary: [],
    steps: [
      'Stand with the balls of your feet on a step or platform, heels hanging off.',
      'Lower your heels until you feel a full stretch.',
      'Rise up onto your toes as high as you can.',
      'Pause at the top, then lower slowly.',
    ],
    tips: ["Don't bounce at the bottom.", 'Seated calf raises (bent knee) put more work on the soleus.'],
  },
  'Seated Cable Row': {
    summary: 'A seated cable pull to your stomach. Works the middle back with steady tension.',
    equipment: 'Cable row machine, close-grip handle',
    primary: ['Lats', 'Upper back (rhomboids, middle traps)'],
    secondary: ['Biceps', 'Rear shoulders'],
    steps: [
      'Sit with your feet on the platform and knees slightly bent.',
      'Grip the handle and sit tall with your arms straight.',
      'Pull the handle to your stomach, driving your elbows back and squeezing your shoulder blades together.',
      'Return until your arms are straight, letting your shoulders reach forward slightly.',
    ],
    tips: ["Don't rock your torso back and forth to move the weight.", 'Keep your chest up.'],
  },
  'Dumbbell Row': {
    summary: 'A one-arm row with one hand and knee braced on a bench.',
    equipment: 'Dumbbell, flat bench',
    primary: ['Lats', 'Upper back'],
    secondary: ['Biceps', 'Rear shoulders'],
    steps: [
      'Put one knee and the same-side hand on a bench, back flat and roughly parallel to the floor.',
      'Hold the dumbbell in your other hand at arm’s length.',
      'Row it up towards your hip, keeping your elbow close to your body.',
      'Lower to a full stretch and repeat, then switch sides.',
    ],
    tips: ["Don't twist your torso to lift the weight.", 'Think about pulling with your elbow, not your hand.'],
  },
  'Chin-up': {
    summary: 'A pull-up with palms facing you. Puts more work on the biceps.',
    equipment: 'Pull-up bar (add weight with a belt if needed)',
    primary: ['Lats', 'Biceps'],
    secondary: ['Upper back', 'Forearms (grip)', 'Core'],
    steps: [
      'Hang from the bar with palms facing you, hands about shoulder width apart.',
      'Pull your shoulders down and back.',
      'Pull up until your chin clears the bar.',
      'Lower to straight arms under control.',
    ],
    tips: ['Avoid swinging.', 'Log any added weight (or 0 for bodyweight).'],
  },
  'Hammer Curl': {
    summary: 'A dumbbell curl with palms facing each other. Works the outer arm and forearms.',
    equipment: 'Dumbbells',
    primary: ['Brachialis', 'Brachioradialis (forearm)'],
    secondary: ['Biceps'],
    steps: [
      'Stand holding dumbbells at your sides, palms facing in.',
      'Keep your elbows at your sides and curl the dumbbells up, palms still facing in.',
      'Squeeze at the top, then lower slowly.',
    ],
    tips: ["Don't swing.", 'Log the weight of one dumbbell.'],
  },
  'Skull Crusher': {
    summary: 'Lying on a bench and lowering a bar towards your forehead by bending only at the elbows.',
    equipment: 'EZ bar or dumbbells, flat bench',
    primary: ['Triceps'],
    secondary: [],
    steps: [
      'Lie on a bench holding the bar over your chest with a narrow grip, arms straight.',
      'Tilt your arms back slightly towards your head.',
      'Bend only at the elbows to lower the bar to just above your forehead or behind your head.',
      'Straighten your arms to lift it back up.',
    ],
    tips: ['Keep your elbows pointing up, not flaring out.', 'Start light. The elbows don’t like heavy, fast reps.'],
  },
};

/**
 * Guides for custom exercises added in the app (not built-ins), keyed by the name as entered in
 * the app. Matched by name, ignoring case, spaces and punctuation (see `nameKey`).
 */
export const EXTRA_GUIDES: Record<string, ExerciseGuide> = {
  'Squat Split single Leg': {
    summary: 'A split squat: one foot forward, one back, lowering straight down. Builds single-leg strength and balance (sometimes called a static lunge).',
    equipment: 'Bodyweight, or dumbbells / barbell for load',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Adductors', 'Hamstrings', 'Core'],
    steps: [
      'Stand in a long stride: front foot flat, back foot on its toes, feet about hip width apart side to side.',
      'Keep your chest up and your weight mostly on the front foot.',
      'Lower straight down until your back knee is just above the floor and your front thigh is about level.',
      'Push through the front heel and mid-foot to stand back up, without moving your feet.',
      'Do all your reps on one side, then switch legs.',
    ],
    tips: [
      'Keep the front knee tracking over your toes, not caving inwards.',
      'Go down, not forwards: the torso stays tall.',
      'Holding a wall or post helps balance while you learn it.',
    ],
  },
  'Single Leg Romanian deadlift': {
    summary: 'A hip hinge on one leg: the other leg swings back as you lower the weight. Works the hamstrings and glutes and challenges balance.',
    equipment: 'Dumbbell(s) or kettlebell',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Lower back (erectors)', 'Core', 'Foot and ankle stabilisers'],
    steps: [
      'Stand on one leg with a soft bend in the knee, holding the weight in the opposite hand (or both hands).',
      'Hinge at the hips, sending the free leg straight back as your chest lowers.',
      'Lower the weight along your standing leg until you feel a stretch in the hamstring, usually around mid-shin.',
      'Keep your hips square to the floor and your back flat.',
      'Drive the hip forward to stand tall, bringing the back leg down. Finish all reps, then switch sides.',
    ],
    tips: [
      "Don't let the hip of the raised leg rotate open.",
      'The standing knee stays slightly bent but does not bend more as you go down.',
      'Go lighter than a two-leg RDL; balance is the limit at first.',
    ],
  },
  'Overhead Dumbbell Press': {
    summary: 'Pressing a pair of dumbbells from shoulder height to overhead while standing. Builds shoulder strength with each arm working on its own.',
    equipment: 'Dumbbells',
    primary: ['Shoulders (deltoids, mainly front)'],
    secondary: ['Triceps', 'Upper chest', 'Upper traps', 'Core'],
    steps: [
      'Stand with feet hip width apart, holding the dumbbells at shoulder height, palms forward or facing in.',
      'Brace your core and squeeze your glutes.',
      'Press the dumbbells straight up until your arms are straight, ending over your shoulders.',
      'Lower them under control back to shoulder height.',
    ],
    tips: [
      "Don't lean back to finish the rep; keep your ribs down.",
      'Keep your forearms vertical under the dumbbells.',
      'Your head moves slightly forward as the weights pass it.',
    ],
  },
  'Half Kneeling Single Arm Press': {
    summary: 'A one-arm overhead press kneeling on one knee. The kneeling stance takes the legs out and makes your core keep you upright.',
    equipment: 'Dumbbell or kettlebell, mat or pad for the knee',
    primary: ['Shoulders (deltoids)'],
    secondary: ['Triceps', 'Core and obliques', 'Glutes (of the down leg)', 'Upper back (serratus)'],
    steps: [
      'Kneel with one knee down and the other foot forward, both at 90°. Hold the weight at the shoulder on the same side as the down knee.',
      'Squeeze the glute of the down leg and brace your core so you are tall.',
      'Press the weight straight up until your arm is straight, biceps by your ear.',
      'Lower it back to the shoulder under control.',
      'Finish all reps, then switch arm and knee.',
    ],
    tips: [
      "Don't lean away from the weight or arch your lower back.",
      'Keep your free hand out to the side or on your hip.',
      'Use a lighter weight than a two-arm press.',
    ],
  },
  'Farmers Carry': {
    summary: 'Walking while holding heavy weights at your sides. Builds grip, traps and core strength, and posture under load. Log the weight in each hand.',
    equipment: 'Dumbbells, kettlebells or farmer handles',
    primary: ['Forearms (grip)', 'Upper traps'],
    secondary: ['Core and obliques', 'Glutes', 'Calves', 'Upper back'],
    steps: [
      'Stand between the weights, squat or hinge down and pick them up with a neutral grip.',
      'Stand tall: shoulders back and down, chest up, core braced.',
      'Walk with short, controlled steps for a set distance or time.',
      'Stop, then set the weights down by squatting or hinging, not rounding your back.',
    ],
    tips: [
      "Don't let the weights swing or touch your legs.",
      'Look straight ahead, not down.',
      'If you log reps, use them for distance (e.g. metres) or seconds, and stay consistent.',
    ],
  },
  'Front Raise': {
    summary: 'Raising weights straight in front of you to shoulder height. Isolates the front of the shoulders.',
    equipment: 'Dumbbells, plate or cable',
    primary: ['Front shoulders (anterior deltoids)'],
    secondary: ['Side shoulders', 'Upper chest', 'Upper traps'],
    steps: [
      'Stand tall holding the dumbbells in front of your thighs, palms facing your body.',
      'With a slight bend in the elbows, raise the weights in front of you to shoulder height.',
      'Pause briefly at the top.',
      'Lower them slowly back to your thighs.',
    ],
    tips: [
      "Don't swing or lean back to lift the weight.",
      'Stop at shoulder height; going higher mostly works the traps.',
      'Light weights work well here; control matters more than load.',
    ],
  },
  'Chin up (jumping)': {
    summary: 'A chin-up where you jump to the top and then lower yourself slowly. A way to build up to full chin-ups by training the lowering part.',
    equipment: 'Pull-up bar (box or bench to jump from if needed)',
    primary: ['Lats', 'Biceps'],
    secondary: ['Upper back (rhomboids, lower traps)', 'Forearms (grip)', 'Core'],
    steps: [
      'Stand under the bar (on a box if needed) and grip it shoulder width apart, palms facing you.',
      'Jump up, pulling at the same time, until your chin is over the bar.',
      'Hold the top briefly with your chest up and shoulders down.',
      'Lower yourself as slowly as you can (aim for 3–5 seconds) to straight arms.',
      'Step or drop back down and reset for the next rep.',
    ],
    tips: [
      'The slow lowering is where the benefit is; don\'t just drop.',
      'Use the smallest jump that gets you to the top; less jump as you get stronger.',
      'Keep your legs still rather than kicking.',
    ],
  },
  'Bicep Close Handed Barbell Curl': {
    summary: 'A barbell curl with the hands closer than shoulder width. Shifts more of the work to the outer (long) head of the biceps.',
    equipment: 'Barbell or EZ bar',
    primary: ['Biceps (more long head)'],
    secondary: ['Forearms (brachioradialis)', 'Brachialis'],
    steps: [
      'Stand tall holding the bar with an underhand grip, hands a few inches apart (inside shoulder width).',
      'Keep your elbows pinned at your sides.',
      'Curl the bar up towards your shoulders, squeezing the biceps at the top.',
      'Lower it slowly until your arms are straight.',
    ],
    tips: [
      "Don't swing your body or let your elbows drift forward.",
      'If your wrists are uncomfortable with a straight bar, use an EZ bar.',
      'Control the lowering; take about 2 seconds.',
    ],
  },
  'Bicep Straight Barbell Curl': {
    summary: 'The standard curl with a straight barbell and a shoulder-width underhand grip. The classic biceps mass builder.',
    equipment: 'Straight barbell',
    primary: ['Biceps'],
    secondary: ['Brachialis', 'Forearms (brachioradialis)'],
    steps: [
      'Stand tall holding the bar with an underhand grip at shoulder width, arms straight.',
      'Keep your elbows by your sides and your shoulders back.',
      'Curl the bar up to shoulder height without moving your elbows forward.',
      'Squeeze at the top, then lower slowly to straight arms.',
    ],
    tips: [
      'No leaning back or using your hips to swing the bar up.',
      'Straighten your arms fully at the bottom of each rep.',
      'Keep your wrists straight, not curled back.',
    ],
  },
  'Bicep seated dumbbell curl': {
    summary: 'Curling dumbbells while sitting on a bench. Sitting stops you swinging, so the biceps do all the work, one arm at a time or both together.',
    equipment: 'Dumbbells, bench',
    primary: ['Biceps'],
    secondary: ['Brachialis', 'Forearms (brachioradialis)'],
    steps: [
      'Sit at the end of a bench (or upright back rest), feet flat, a dumbbell in each hand with arms hanging straight.',
      'Turn your palms forward, keeping your elbows at your sides.',
      'Curl the dumbbells up to your shoulders, squeezing at the top.',
      'Lower them slowly to straight arms.',
    ],
    tips: [
      'Sit tall; keep your back against the pad if there is one.',
      "Don't let your elbows swing forward as you curl.",
      'You can turn your palms up as you lift (supinate) for a stronger squeeze.',
    ],
  },
  'Box Squat Jump': {
    summary: 'Jumping from the floor onto a box, landing in a squat. Builds explosive leg power with a softer landing than jumping on the spot.',
    equipment: 'Sturdy plyo box or platform',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Hamstrings', 'Calves', 'Core'],
    steps: [
      'Stand about a foot from the box, feet hip to shoulder width apart.',
      'Swing your arms back and drop into a quarter squat.',
      'Drive your arms forward and jump explosively up onto the box.',
      'Land softly with your whole foot on the box, knees bent and in line with your toes.',
      'Stand up tall, then step down (don\'t jump down) and reset.',
    ],
    tips: [
      'Choose a box you can land on comfortably; height is about the jump, not how high you tuck.',
      'Land quietly, absorbing through your hips and knees.',
      'Do these fresh, early in the workout, with full rest between reps. Log the box height or bodyweight in weight.',
    ],
  },
};

/** A name reduced to lowercase letters and digits, so "Chin up (jumping)" matches "chin-up jumping". */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const EXTRA_NAME_BY_KEY = new Map(Object.keys(EXTRA_GUIDES).map((name) => [nameKey(name), name]));

/** The name its guide is keyed by in GUIDES or EXTRA_GUIDES, if the exercise has one. */
function guideName(exercise: Pick<Exercise, 'id' | 'name'>): string | undefined {
  const byId = DEFAULT_EXERCISES.find((n) => defaultExerciseId(n) === exercise.id);
  if (byId) return byId;
  const byName = defaultExerciseId(exercise.name);
  const name = DEFAULT_EXERCISES.find((n) => defaultExerciseId(n) === byName);
  if (name) return name;
  return EXTRA_NAME_BY_KEY.get(nameKey(exercise.name));
}

/**
 * The guide for an exercise. A built-in is found by its fixed id, so a renamed built-in keeps
 * its guide; otherwise by name, against the built-ins and then `EXTRA_GUIDES`.
 */
export function guideFor(exercise: Pick<Exercise, 'id' | 'name'>): ExerciseGuide | undefined {
  const name = guideName(exercise);
  return name ? (GUIDES[name] ?? EXTRA_GUIDES[name]) : undefined;
}

/** The file name stem of a guide's photos in public/exercise-photos ("Chin up (jumping)" -> "chin-up-jumping"). */
export function photoSlug(guideName: string): string {
  return guideName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Start and finish photos for an exercise that has a guide (every guide has a pair). Paths are
 * relative so they work under any base. Photos are from Free Exercise DB (public domain).
 */
export function photosFor(exercise: Pick<Exercise, 'id' | 'name'>): [string, string] | undefined {
  const name = guideName(exercise);
  if (!name) return undefined;
  const slug = photoSlug(name);
  return [`exercise-photos/${slug}-0.jpg`, `exercise-photos/${slug}-1.jpg`];
}
