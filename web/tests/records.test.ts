import { describe, expect, it } from 'vitest';
import { completionsCsv, type CompletionRecord } from '../src/lib/server/records';

describe('completion CSV safety', () => {
  it('quotes delimiters/newlines and prevents spreadsheet formula execution', () => {
    const record = { id: 'id', personName: '=HYPERLINK("https://bad")', siteName: 'Site, East',
      courseTitle: 'Course\nname', sourceReference: ' @SUM(1)', state: 'effective' } as CompletionRecord;
    const csv = completionsCsv([record]);
    expect(csv).toContain('"\'=HYPERLINK(""https://bad"")"');
    expect(csv).toContain('"Site, East"');
    expect(csv).toContain('"Course\nname"');
    expect(csv).toContain('"\' @SUM(1)"');
  });
});
