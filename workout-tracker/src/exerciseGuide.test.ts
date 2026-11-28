import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES, defaultExerciseId } from './db';
import { EXTRA_GUIDES, GUIDES, guideFor, photoSlug, photosFor } from './exerciseGuide';

/** The photo files that ship in public/, as "exercise-photos/<name>". */
const PHOTO_FILES = new Set(
  Object.keys(import.meta.glob('../public/exercise-photos/*.jpg')).map((p) => p.replace('../public/', '')),
);

describe('exercise guides', () => {
  it('has a complete guide for every built-in exercise', () => {
    for (const name of DEFAULT_EXERCISES) {
      const g = GUIDES[name];
      expect(g, name).toBeDefined();
      expect(g.summary.length, name).toBeGreaterThan(20);
      expect(g.primary.length, name).toBeGreaterThan(0);
      expect(g.steps.length, name).toBeGreaterThanOrEqual(3);
      expect(g.equipment, name).toBeTruthy();
    }
    expect(Object.keys(GUIDES).sort()).toEqual([...DEFAULT_EXERCISES].sort());
  });

  it('finds a guide by fixed id even after a rename, or by name', () => {
    expect(guideFor({ id: defaultExerciseId('Squat')!, name: 'Back Squat' })).toBe(GUIDES.Squat);
    expect(guideFor({ id: 'some-uuid', name: 'bench press' })).toBe(GUIDES['Bench Press']);
    expect(guideFor({ id: 'some-uuid', name: 'Cable Crunch' })).toBeUndefined();
  });

  it('finds guides for added exercises by name, ignoring case and punctuation', () => {
    for (const [name, g] of Object.entries(EXTRA_GUIDES)) {
      expect(g.summary.length, name).toBeGreaterThan(20);
      expect(g.primary.length, name).toBeGreaterThan(0);
      expect(g.steps.length, name).toBeGreaterThanOrEqual(3);
      expect(guideFor({ id: 'some-uuid', name }), name).toBe(g);
    }
    expect(guideFor({ id: 'x', name: 'chin-up jumping' })).toBe(EXTRA_GUIDES['Chin up (jumping)']);
    expect(guideFor({ id: 'x', name: ' FARMERS CARRY ' })).toBe(EXTRA_GUIDES['Farmers Carry']);
  });

  it('has a start and finish photo for every guide', () => {
    expect(PHOTO_FILES.size).toBe(2 * (Object.keys(GUIDES).length + Object.keys(EXTRA_GUIDES).length));
    for (const name of [...Object.keys(GUIDES), ...Object.keys(EXTRA_GUIDES)]) {
      for (const i of [0, 1]) {
        expect(PHOTO_FILES.has(`exercise-photos/${photoSlug(name)}-${i}.jpg`), `${name} ${i}`).toBe(true);
      }
    }
    expect(photosFor({ id: defaultExerciseId('Squat')!, name: 'Back Squat' })).toEqual([
      'exercise-photos/squat-0.jpg',
      'exercise-photos/squat-1.jpg',
    ]);
    expect(photosFor({ id: 'x', name: 'chin-up jumping' })?.[0]).toBe('exercise-photos/chin-up-jumping-0.jpg');
    expect(photosFor({ id: 'x', name: 'Cable Crunch' })).toBeUndefined();
  });
});
