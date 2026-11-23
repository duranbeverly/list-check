import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { guessColumns } from '../src/columns';
import { cleanPhone, findDuplicates, toMembers } from '../src/rules';
import type { RawRow } from '../src/types';

// Load the real sample with blank lines preserved for accurate row numbers.
function loadSampleMembers() {
  const csv = readFileSync(new URL('../public/sample-members.csv', import.meta.url), 'utf8');
  const results = Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: false });
  const columns = guessColumns(results.meta.fields ?? []);

  return toMembers(results.data, columns);
}

describe('cleanPhone', () => {
  // Convert common US phone formats to the same international form.
  it.each([
    { input: '571-555-0101', phone: '+15715550101' },
    { input: '(571) 555-0102', phone: '+15715550102' },
    { input: '5715550103', phone: '+15715550103' },
    { input: '15715550104', phone: '+15715550104' },
    { input: '+15715550105', phone: '+15715550105' },
  ])('cleans $input', ({ input, phone }) => {
    expect(cleanPhone(input)).toEqual({ ok: true, phone });
  });

  // Explain when a number is too short to use.
  it('reports a too-short number', () => {
    expect(cleanPhone('555-01')).toEqual({ ok: false, why: 'too short' });
  });

  // Treat empty and whitespace-only values as missing.
  it.each(['', '   '])('reports %j as missing', (input) => {
    expect(cleanPhone(input)).toEqual({ ok: false, why: 'missing' });
  });

  // Keep an already-clean number unchanged.
  it('is idempotent for a clean number', () => {
    const result = cleanPhone('+15715550101');

    expect(result).toEqual({ ok: true, phone: '+15715550101' });
    if (result.ok) {
      expect(cleanPhone(result.phone)).toEqual(result);
    }
  });
});

describe('toMembers', () => {
  // Keep the sample's actual file line after its blank line.
  it('keeps Grace on row 15', () => {
    const members = loadSampleMembers();

    expect(members.find((member) => member.firstName === 'Grace')?.row).toBe(15);
  });

  // Trim member details but preserve the untouched source row.
  it('trims values and keeps the original row', () => {
    const original: RawRow = {
      first_name: ' Maria ',
      last_name: ' Lopez ',
      email: ' Maria@example.com ',
      phone: ' 571-555-0101 ',
    };
    const columns = guessColumns(Object.keys(original));
    const [member] = toMembers([original], columns);

    expect(member).toMatchObject({
      row: 2,
      firstName: 'Maria',
      lastName: 'Lopez',
      email: 'Maria@example.com',
      phone: { ok: true, phone: '+15715550101' },
    });
    expect(member.original).toBe(original);
  });
});

describe('findDuplicates', () => {
  // Flag only the known repeat email and phone groups in the sample.
  it('finds repeat contacts without merging shared-phone households', () => {
    const groups = findDuplicates(loadSampleMembers());

    expect(groups.map(({ kind, key, rows }) => ({
      kind,
      key,
      rows: rows.map((member) => member.row),
    }))).toEqual([
      { kind: 'same email', key: 'maria.lopez@example.com', rows: [2, 9] },
      { kind: 'same phone', key: '+15715550110', rows: [10, 11] },
      { kind: 'shared phone', key: '+15715550111', rows: [12, 13] },
    ]);
  });

  // Keep group order stable when members arrive in a different order.
  it('returns the same groups for reversed input', () => {
    const members = loadSampleMembers();

    expect(findDuplicates([...members].reverse())).toEqual(findDuplicates(members));
  });

  // Normalize email and names before deciding whether a phone is shared.
  it('matches Unicode-equivalent emails and names', () => {
    const rows: RawRow[] = [
      {
        first_name: 'Jose\u0301',
        last_name: 'Reyes',
        email: 'jose\u0301@example.com',
        phone: '571-555-0101',
      },
      {
        first_name: 'José',
        last_name: 'REYES',
        email: 'José@example.com',
        phone: '(571) 555-0101',
      },
    ];
    const members = toMembers(rows, guessColumns(Object.keys(rows[0])));
    const groups = findDuplicates(members);

    expect(groups.map(({ kind, key }) => ({ kind, key }))).toEqual([
      { kind: 'same email', key: 'josé@example.com' },
      { kind: 'same phone', key: '+15715550101' },
    ]);
  });
});
