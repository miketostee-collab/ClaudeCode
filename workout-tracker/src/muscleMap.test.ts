import { describe, expect, it } from 'vitest';
import { EXTRA_GUIDES, GUIDES } from './exerciseGuide';
import { activationFor, muscleRegions } from './muscleMap';

describe('muscle diagram mapping', () => {
  it('draws every muscle named in every guide', () => {
    for (const [name, g] of Object.entries({ ...GUIDES, ...EXTRA_GUIDES })) {
      for (const m of [...g.primary, ...g.secondary]) {
        expect(muscleRegions(m).length, `${name}: ${m}`).toBeGreaterThan(0);
      }
    }
  });

  it('maps specific wording to the right regions', () => {
    expect(muscleRegions('Front shoulders (anterior deltoids)')).toEqual(['frontDelts']);
    expect(muscleRegions('Shoulders (deltoids)')).toEqual(['frontDelts', 'sideDelts', 'rearDelts']);
    expect(muscleRegions('Upper back and traps')).toEqual(['upperBack', 'traps']);
    expect(muscleRegions('Brachialis')).toEqual(['biceps']);
    expect(muscleRegions('Brachioradialis (forearm)')).toEqual(['forearms']);
    expect(muscleRegions('Forearms (brachialis, brachioradialis)')).toEqual(['forearms']);
    expect(muscleRegions('Calves (gastrocnemius, soleus)')).toEqual(['calves']);
    expect(muscleRegions('Something else')).toEqual([]);
  });

  it('marks a region primary when it is both primary and secondary', () => {
    const a = activationFor({ primary: ['Triceps', 'Lower chest'], secondary: ['Front shoulders', 'Upper chest'] });
    expect(a.get('chest')).toBe('primary');
    expect(a.get('triceps')).toBe('primary');
    expect(a.get('frontDelts')).toBe('secondary');
    expect(a.has('quads')).toBe(false);
  });
});
