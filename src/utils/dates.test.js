import { afterAll, describe, expect, it } from 'vitest';
import { endOfLocalDay, localDateKey, localMonthKey, parseLocalDate, startOfLocalDay } from './dates';

const originalTZ = process.env.TZ;
afterAll(() => { process.env.TZ = originalTZ; });

// Near midnight the UTC date differs from the local one: these cases failed with toISOString()
describe.each(['Europe/Oslo', 'America/New_York', 'Pacific/Auckland'])('local dates in %s', (tz) => {
  it('gives the local calendar day at 23:30 and 00:30', () => {
    process.env.TZ = tz;
    expect(localDateKey(new Date(2026, 2, 1, 23, 30))).toBe('2026-03-01');
    expect(localDateKey(new Date(2026, 2, 2, 0, 30))).toBe('2026-03-02');
    expect(localMonthKey(new Date(2026, 2, 31, 23, 59))).toBe('2026-03');
  });

  it('reads YYYY-MM-DD as local midnight, so a report range starts on the chosen day', () => {
    process.env.TZ = tz;
    const from = parseLocalDate('2026-03-01');
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([2026, 2, 1, 0]);
    const seizure = new Date(2026, 2, 1, 0, 15).getTime();
    expect(seizure >= from.getTime() && seizure <= endOfLocalDay(parseLocalDate('2026-03-01'))).toBe(true);
    expect(startOfLocalDay(seizure)).toBe(from.getTime());
  });
});

it('rejects malformed date keys', () => {
  expect(Number.isNaN(parseLocalDate('03/01/2026').getTime())).toBe(true);
});
