import { describe, expect, it } from 'vitest';
import { guessColumns } from '../src/columns';

describe('guessColumns', () => {
  // Match the common column names used in contact lists.
  it('recognizes phone, email, and opt-out headers', () => {
    expect(guessColumns(['Cell Phone']).phone).toBe('Cell Phone');
    expect(guessColumns(['Email Address']).email).toBe('Email Address');
    expect(guessColumns(['Do Not Text']).optOut).toBe('Do Not Text');
  });

  // Ignore letter case and extra spaces when matching.
  it('matches headers with spaces and capitals', () => {
    expect(guessColumns(['  cElL pHoNe  ']).phone).toBe('  cElL pHoNe  ');
  });

  // Return null when no phone column is available.
  it('returns null when no phone-like header is found', () => {
    expect(guessColumns(['Email Address', 'Do Not Text']).phone).toBeNull();
  });

  // Prefer known header names in a fixed order.
  it('uses alias priority when more than one phone header matches', () => {
    expect(guessColumns(['Mobile', 'Phone']).phone).toBe('Phone');
  });
});
