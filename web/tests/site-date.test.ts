import { describe, expect, it } from 'vitest';
import { endOfSiteDay, localDate } from '../src/lib/site-date';

describe('site-local deadlines', () => {
  it('keeps the chosen local day across summer and winter offsets', () => {
    expect(endOfSiteDay('2028-06-15', 'America/New_York')).toBe('2028-06-16T03:59:59.000Z');
    expect(endOfSiteDay('2028-01-15', 'America/New_York')).toBe('2028-01-16T04:59:59.000Z');
    expect(localDate('2028-06-16T03:59:59.000Z', 'America/New_York')).toBe('2028-06-15');
  });

  it('rejects an impossible calendar day', () => {
    expect(() => endOfSiteDay('2028-02-31', 'America/New_York')).toThrow();
  });
});
