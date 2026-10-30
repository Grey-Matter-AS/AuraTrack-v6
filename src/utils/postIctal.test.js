import { describe, expect, it } from 'vitest';
import { findingText, normalizePostIctal, recoveryText } from './postIctal';

const t = (key, opts) => key + (opts?.time ? `:${opts.time}` : '');

describe('after-seizure findings', () => {
  it('reads the first version without losing anything', () => {
    const old = {
      findings: ['Confusion', 'Sleepiness', 'Weakness', 'Speech difficulty'],
      paralysisLocations: [{ region: 'Arms', subRegion: 'Left', specificPart: 'Hand', label: 'After-seizure Paralysis', med: "Todd's paralysis" }],
    };
    expect(normalizePostIctal(old)).toEqual({
      findings: [
        { key: 'confused', locations: [] },
        { key: 'drowsy', locations: [] },
        { key: 'weakness', locations: [] },
        { key: 'custom', label: 'Speech difficulty', locations: [] },
        { key: 'paralysis', locations: [{ region: 'Arms', subRegion: 'Left', specificPart: 'Hand' }] },
      ],
      recoveryMinutes: null,
      recoveryOngoing: false,
    });
  });

  it('keeps the current shape as it is, merging duplicate areas', () => {
    const area = { region: 'Legs', subRegion: 'Right', specificPart: 'Foot' };
    const p = normalizePostIctal({ findings: [{ key: 'numbness', locations: [area] }, { key: 'numbness', locations: [area] }], recoveryMinutes: 45 });
    expect(p.findings).toEqual([{ key: 'numbness', locations: [area] }]);
    expect(p.recoveryMinutes).toBe(45);
  });

  it('describes a finding with its areas and the recovery time', () => {
    const finding = { key: 'numbness', locations: [{ region: 'Arms', subRegion: 'Left', specificPart: 'Hand' }] };
    expect(findingText(finding, t)).toBe('post_ictal.finding.numbness (Arms › Left › Hand)');
    expect(recoveryText({ recoveryMinutes: 150 }, t)).toBe('post_ictal.recovery_after_text:2 h 30 min');
    expect(recoveryText({ recoveryOngoing: true }, t)).toBe('post_ictal.recovery_ongoing_text');
    expect(recoveryText({}, t)).toBe('');
  });

  it('ignores junk', () => {
    expect(normalizePostIctal({ findings: [null, 5, { key: 'custom' }], recoveryMinutes: 'x' })).toEqual({ findings: [], recoveryMinutes: null, recoveryOngoing: false });
  });
});
