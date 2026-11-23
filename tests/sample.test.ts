import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { expect, it } from 'vitest';
import { guessColumns } from '../src/columns';
import { checkList, findDuplicates, findFatalParseError, toMembers } from '../src/rules';
import type { RawRow } from '../src/types';

// Keep the real sample working through the full list-checking flow.
it('processes every sample member with correct rows and safety buckets', () => {
  const csv = readFileSync(new URL('../public/sample-members.csv', import.meta.url), 'utf8');
  const parsed = Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: false, delimiter: ',' });

  expect(parsed.errors.some((error) => error.code === 'TooFewFields')).toBe(true);
  expect(findFatalParseError(parsed.errors, parsed.data)).toBeNull();

  const columns = guessColumns(parsed.meta.fields ?? []);
  const members = toMembers(parsed.data, columns);
  const groups = findDuplicates(members);
  const buckets = checkList(members, groups);

  expect(members).toHaveLength(16);
  expect(members.find((member) => member.firstName === 'Grace')?.row).toBe(15);
  expect(groups.map(({ kind, rows }) => [kind, rows.map((member) => member.row)])).toEqual([
    ['same email', [2, 9]],
    ['same phone', [10, 11]],
    ['shared phone', [12, 13]],
  ]);
  expect(buckets.ready).toHaveLength(5);
  expect(buckets.needsReview).toHaveLength(8);
  expect(buckets.optedOut).toHaveLength(3);
});
