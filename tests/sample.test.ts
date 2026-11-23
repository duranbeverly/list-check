import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { expect, it } from 'vitest';
import { guessColumns } from '../src/columns';
import { checkList, findDuplicates, findFatalParseError, toCsv, toMembers } from '../src/rules';
import type { RawRow } from '../src/types';

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed >>> 0;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

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

  const shuffledMembers = toMembers(seededShuffle(parsed.data, 20_261_122), columns);
  const shuffledBuckets = checkList(shuffledMembers, findDuplicates(shuffledMembers));
  const emails = (items: typeof buckets.ready) => items.map((member) => member.email).sort();
  expect(emails(shuffledBuckets.ready)).toEqual(emails(buckets.ready));
  expect(emails(shuffledBuckets.needsReview)).toEqual(emails(buckets.needsReview));
  expect(emails(shuffledBuckets.optedOut)).toEqual(emails(buckets.optedOut));
});

it('matches golden CSVs for all three sample downloads byte for byte', () => {
  const parsed = Papa.parse<RawRow>(
    readFileSync(new URL('../public/sample-members.csv', import.meta.url), 'utf8'),
    { header: true, skipEmptyLines: false, delimiter: ',' },
  );
  const headers = parsed.meta.fields ?? [];
  const members = toMembers(parsed.data, guessColumns(headers));
  const buckets = checkList(members, findDuplicates(members));

  for (const [name, bucket] of [
    ['ready', buckets.ready],
    ['needs-review', buckets.needsReview],
    ['opted-out', buckets.optedOut],
  ] as const) {
    const expected = readFileSync(new URL(`./fixtures/golden/${name}.csv`, import.meta.url));
    expect(Buffer.from(toCsv(bucket, headers), 'utf8')).toEqual(expected);
  }
});
