import { describe, expect, it } from 'vitest';
import { baseSetName, mostUsedSymptoms, rememberCustom, setsForType, suggestSetName } from './symptomSets';

// Like i18next: a fallback text given as the second argument is returned for keys it doesn't know
const t = (key, opts) => (typeof opts === 'string' ? opts : key === 'symptom_sets.more' ? `+ ${opts.count} more` : key === 'symptom_sets.no_type' ? 'No type' : key);
const tingling = { symptom: 'Tingling', detail: 'Pins', region: 'Arms', subRegion: 'Left Arm', specificPart: 'Hand/Fingers' };
const staring = { symptom: 'Staring Blankly', region: 'N/A', specificPart: 'Internal/General' };

describe('saved symptom set names', () => {
  it('follows <type> · <main symptom> (<area>) + N more', () => {
    expect(baseSetName('Focal Aware', [tingling, staring, staring], t)).toBe('Focal Aware · Tingling (Left Arm – Hand/Fingers) + 2 more');
    expect(baseSetName('Absence', [staring], t)).toBe('Absence · Staring Blankly');
  });

  it('is unique within a seizure type and at most 60 characters', () => {
    const sets = [{ id: 'a', name: 'Absence · Staring Blankly', seizureType: 'Absence' }];
    expect(suggestSetName('Absence', [staring], sets, t)).toBe('Absence · Staring Blankly (2)');
    expect(suggestSetName('Focal Aware', [staring], sets, t)).toBe('Focal Aware · Staring Blankly');
    expect(suggestSetName('Absence', [staring], sets, t, 'a')).toBe('Absence · Staring Blankly');
    expect(baseSetName('Focal Impaired', [{ symptom: 'x'.repeat(80) }], t).length).toBe(60);
  });
});

describe('sets per seizure type', () => {
  const sets = [
    { id: 1, seizureType: 'Absence' },
    { id: 2, seizureType: 'Focal Aware' },
    { id: 3 },
  ];
  it('offers the type\'s own sets, then unassigned ones', () => {
    expect(setsForType(sets, 'Absence').map(s => s.id)).toEqual([1, 3]);
  });
  it('offers every set when no type was chosen', () => {
    expect(setsForType(sets, '').map(s => s.id)).toEqual([1, 2, 3]);
    expect(setsForType(sets, 'Uncategorized')).toHaveLength(3);
  });
});

describe('most used symptoms', () => {
  const now = 1_800_000_000_000;
  const day = 86400000;
  const events = [
    { type: 'Focal Aware', startTime: now - day, symptoms: [tingling, staring] },
    { type: 'Focal Aware', startTime: now - 2 * day, symptoms: [tingling] },
    { type: 'Absence', startTime: now - day, symptoms: [staring, staring] },
    { type: 'Focal Aware', startTime: now - 100 * day, symptoms: [staring, staring, staring] },
  ];
  it('counts only this type in the last 90 days', () => {
    expect(mostUsedSymptoms(events, 'Focal Aware', now)).toEqual([tingling, staring]);
    expect(mostUsedSymptoms(events, '', now)).toEqual([]);
  });
});

describe('the user\'s own symptoms', () => {
  it('are capitalised and never stored twice', () => {
    let list = rememberCustom([], { kind: 'symptom', group: 'Sensory', label: 'buzzing in ears' });
    list = rememberCustom(list, { kind: 'symptom', group: 'Sensory', label: 'Buzzing in ears' });
    expect(list).toEqual([{ kind: 'symptom', group: 'Sensory', label: 'Buzzing in ears' }]);
    expect(rememberCustom(list, { kind: 'post_ictal', label: '  ' })).toBe(list);
  });
});
