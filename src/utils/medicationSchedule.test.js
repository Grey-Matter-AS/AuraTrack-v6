import { describe, expect, it } from 'vitest';
import { diffRegimen, getScheduledDosesForDay, regimenAt, regimenSnapshot, slotDose } from './medicationSchedule';

const DAY = 86400000;
const day0 = new Date(2026, 2, 1).getTime();
const med = {
  id: 1, uuid: 'm', name: 'Levetiracetam', activeIngredient: 'Levetiracetam', dose: 500, unit: 'mg',
  frequency: 'BD', scheduledTimes: ['08:00', '20:00'], scheduledDays: [0, 1, 2, 3, 4, 5, 6], active: true, slotDoses: {},
};

describe('regimen history', () => {
  const started = { medicationUuid: 'm', type: 'started', effectiveAt: day0, recordedAt: day0, from: null, to: regimenSnapshot(med) };
  const raised = {
    medicationUuid: 'm', type: 'changed', effectiveAt: day0 + 10 * DAY, recordedAt: day0 + 10 * DAY,
    from: regimenSnapshot(med), to: regimenSnapshot({ ...med, dose: 750 }),
  };
  const current = { ...med, dose: 750 };

  it('gives the regimen in force at each moment', () => {
    expect(regimenAt(current, [started, raised], day0 - 1)).toBeNull();
    expect(regimenAt(current, [started, raised], day0 + DAY).dose).toBe(500);
    expect(regimenAt(current, [started, raised], day0 + 11 * DAY).dose).toBe(750);
  });

  it('shows nothing after the medication was stopped', () => {
    const stopped = { medicationUuid: 'm', type: 'stopped', effectiveAt: day0 + 20 * DAY, recordedAt: day0 + 20 * DAY, from: raised.to, to: null };
    expect(regimenAt({ ...current, active: false }, [started, raised, stopped], day0 + 21 * DAY)).toBeNull();
  });

  it('schedules each dose with the regimen in force at that dose time', () => {
    const doses = getScheduledDosesForDay([current], day0 + 10 * DAY, [started, raised]);
    expect(doses.map(d => [d.scheduledHHMM, d.dose])).toEqual([['08:00', 750], ['20:00', 750]]);
    const before = getScheduledDosesForDay([current], day0 + 5 * DAY, [started, raised]);
    expect(before.map(d => d.dose)).toEqual([500, 500]);
  });
});

describe('regimen differences', () => {
  it('ignores ingredient capitalisation and reports per-slot dose changes', () => {
    const from = regimenSnapshot(med);
    expect(diffRegimen(from, { ...from, activeIngredient: 'levetiracetam' })).toEqual([]);
    const to = { ...from, slotDoses: { '20:00': 1000 } };
    expect(diffRegimen(from, to)).toEqual(['slotDose:20:00']);
    expect(slotDose(to, '20:00')).toBe(1000);
    expect(slotDose(to, '08:00')).toBe(500);
  });
});
