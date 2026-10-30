import { describe, expect, it } from 'vitest';
import { buildDangerMap, computeDangerFlags, emergencyPlan, isLongSeizure, seizureSeconds } from './dangerFlags';

const MIN = 60 * 1000;
const at = (minutes, extra = {}) => ({ id: minutes, startTime: 1_700_000_000_000 + minutes * MIN, duration: 60, ...extra });

describe('emergency plan settings', () => {
  it('defaults to a 5-minute alert and 3 seizures within 8 minutes', () => {
    expect(emergencyPlan()).toMatchObject({ alertSec: 300, warnSec: 240, clusterMinCount: 3, clusterWindowMs: 8 * MIN });
  });

  it('keeps the alert below the 12-minute auto-stop and rejects nonsense', () => {
    expect(emergencyPlan({ emergencyAlertMinutes: 30 }).alertMinutes).toBe(11);
    expect(emergencyPlan({ emergencyAlertMinutes: 0 }).alertMinutes).toBe(1);
    expect(emergencyPlan({ clusterMinCount: 'x' }).clusterMinCount).toBe(3);
  });
});

describe('long seizure', () => {
  it('is judged at exactly the alert time, the same as the live alert', () => {
    expect(isLongSeizure({ duration: 299 })).toBe(false);
    expect(isLongSeizure({ duration: 300 })).toBe(true);
    expect(isLongSeizure({ duration: 420 }, emergencyPlan({ emergencyAlertMinutes: 7 }))).toBe(true);
  });

  it('does not count the aura or a long recovery', () => {
    const start = 1_700_000_000_000;
    const event = { startTime: start, duration: 600, laps: { aura: start + 180_000, seizure: start + 300_000, recovery: start + 600_000 } };
    expect(seizureSeconds(event)).toBe(120);
    expect(isLongSeizure(event)).toBe(false);
  });

  it('counts to the end when the seizure end was never tapped', () => {
    const start = 1_700_000_000_000;
    expect(seizureSeconds({ startTime: start, duration: 400, laps: { aura: start + 60_000, recovery: start + 400_000 } })).toBe(340);
  });

  it('uses an edited seizure time', () => {
    expect(seizureSeconds({ duration: 900, manualDurations: { seizure: 200 } })).toBe(200);
  });
});

describe('clusters', () => {
  it('flags 3 seizures within 8 minutes, not 2', () => {
    const events = [at(0), at(4), at(8)];
    expect(buildDangerMap(events)[0].flags).toContain('cluster');
    expect(buildDangerMap([at(0), at(4)])[0].flags).not.toContain('cluster');
  });

  it('is exact at the window edge', () => {
    expect(buildDangerMap([at(0), at(8), at(16)])[8].clusterCount).toBe(3);
    const justOutside = [at(0), { ...at(8), startTime: at(8).startTime + 1000 }, at(20)];
    expect(buildDangerMap(justOutside)[0].flags).not.toContain('cluster');
  });

  it('follows the user\'s rule', () => {
    const plan = emergencyPlan({ clusterMinCount: 2, clusterWindowMinutes: 24 * 60 });
    expect(buildDangerMap([at(0), at(600)], plan)[0].flags).toContain('cluster');
  });

  it('gives the same answer for one event as for the whole list', () => {
    const events = [at(0), at(3), at(6), at(30)];
    for (const event of events) {
      expect(computeDangerFlags(event, events)).toEqual(buildDangerMap(events)[event.id]);
      expect(computeDangerFlags(event, events.filter(e => e !== event))).toEqual(buildDangerMap(events)[event.id]);
    }
  });
});
