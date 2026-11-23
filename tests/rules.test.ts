import { describe, expect, it } from 'vitest';
import { cleanPhone } from '../src/rules';

describe('cleanPhone', () => {
  // Convert common US phone formats to the same international form.
  it.each([
    ['571-555-0101', '+15715550101'],
    ['(571) 555-0102', '+15715550102'],
    ['5715550103', '+15715550103'],
    ['15715550104', '+15715550104'],
    ['+15715550105', '+15715550105'],
  ])('cleans %s', (input, phone) => {
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
