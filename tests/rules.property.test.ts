import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { guessColumns } from '../src/columns';
import { checkList, cleanPhone, findDuplicates, toMembers } from '../src/rules';
import type { RawRow } from '../src/types';

describe('rules property checks', () => {
  // Keep phone cleaning safe for arbitrary text.
  it('does not throw for random phone values', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (value) => {
        expect(() => cleanPhone(value)).not.toThrow();
      }),
      { seed: 725_2026, numRuns: 300 },
    );
  });

  // Assign every member to exactly one bucket for arbitrary lists.
  it('places each member in one bucket and keeps the total count', () => {
    const columns = guessColumns(['first_name', 'last_name', 'email', 'phone', 'opt_out']);
    const memberRows = fc.array(
      fc.record({
        firstName: fc.string({ maxLength: 20 }),
        lastName: fc.string({ maxLength: 20 }),
        email: fc.string({ maxLength: 40 }),
        phone: fc.string({ maxLength: 30 }),
        optOut: fc.string({ maxLength: 20 }),
      }),
      { maxLength: 20 },
    );

    fc.assert(
      fc.property(memberRows, (values) => {
        const rows: RawRow[] = values.map((value) => ({
          first_name: value.firstName,
          last_name: value.lastName,
          email: value.email,
          phone: value.phone,
          opt_out: value.optOut,
        }));
        const members = toMembers(rows, columns);
        const buckets = checkList(members, findDuplicates(members));
        const allMembers = [...buckets.ready, ...buckets.needsReview, ...buckets.optedOut];

        expect(allMembers).toHaveLength(members.length);
        expect(new Set(allMembers.map((member) => member.row)).size).toBe(members.length);
      }),
      { seed: 902_2026, numRuns: 300 },
    );
  });
});
