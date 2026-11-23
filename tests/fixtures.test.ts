import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { guessColumns } from '../src/columns';
import { decodeCsvBytes } from '../src/csv';
import {
  checkList,
  findDuplicates,
  findFatalParseError,
  formatReviewReason,
  toMembers,
} from '../src/rules';
import type { RawRow } from '../src/types';

const fixtureNames = [
  'action-network',
  'email-only',
  'excel-scientific',
  'extension',
  'international',
  'mailchimp',
  'plain-spreadsheet',
  'van',
];

describe('CSV fixtures', () => {
  it('matches the expected result for each supported export and edge case', () => {
    for (const name of fixtureNames) {
      const csv = readFileSync(new URL(`./fixtures/${name}.csv`, import.meta.url), 'utf8');
      const expected = JSON.parse(
        readFileSync(new URL(`./fixtures/${name}.expected.json`, import.meta.url), 'utf8'),
      ) as {
        ready: string[];
        needsReview: string[];
        optedOut: string[];
        reviewReasons?: Record<string, string[]>;
      };
      const parsed = Papa.parse<RawRow>(csv, {
        header: true,
        skipEmptyLines: false,
        delimiter: ',',
      });

      expect(findFatalParseError(parsed.errors, parsed.data), name).toBeNull();
      const columns = guessColumns(parsed.meta.fields ?? []);
      expect(columns.optOutConfidence, name).toBe('high');
      const members = toMembers(parsed.data, columns);
      const buckets = checkList(members, findDuplicates(members));

      expect(buckets.ready.map((member) => member.firstName), name).toEqual(expected.ready);
      expect(buckets.needsReview.map((member) => member.firstName), name)
        .toEqual(expected.needsReview);
      expect(buckets.optedOut.map((member) => member.firstName), name)
        .toEqual(expected.optedOut);
      for (const [firstName, reasons] of Object.entries(expected.reviewReasons ?? {})) {
        const member = buckets.needsReview.find((item) => item.firstName === firstName);
        expect(member, `${name}: ${firstName} should need review`).toBeDefined();
        expect(member!.reasons.map(formatReviewReason)).toEqual(reasons);
      }
    }
  });

  it('normalizes mixed line endings before parsing', () => {
    const encoded = readFileSync(
      new URL('./fixtures/mixed-line-endings.csv.base64', import.meta.url),
      'utf8',
    );
    const decoded = decodeCsvBytes(Buffer.from(encoded, 'base64'));
    const parsed = Papa.parse<RawRow>(decoded.text, { header: true, delimiter: ',' });

    expect(decoded.encoding).toBe('UTF-8');
    expect(decoded.text).not.toContain('\r');
    expect(parsed.data.filter((row) => row.first_name).map((row) => row.first_name))
      .toEqual(['Ana', 'Luis']);
    const members = toMembers(parsed.data, guessColumns(parsed.meta.fields ?? []));
    const buckets = checkList(members, findDuplicates(members));
    expect(buckets.ready).toHaveLength(2);
  });

  it('recovers accented names from a Windows-1252 export', () => {
    const encoded = readFileSync(
      new URL('./fixtures/windows-1252.csv.base64', import.meta.url),
      'utf8',
    );
    const decoded = decodeCsvBytes(Buffer.from(encoded, 'base64'));
    const parsed = Papa.parse<RawRow>(decoded.text, { header: true, delimiter: ',' });

    expect(decoded.encoding).toBe('Windows-1252');
    expect(parsed.data[0]).toMatchObject({ first_name: 'José', last_name: 'Peña' });
    const members = toMembers(parsed.data, guessColumns(parsed.meta.fields ?? []));
    const buckets = checkList(members, findDuplicates(members));
    expect(buckets.ready.map((member) => member.firstName)).toEqual(['José']);
  });
});
