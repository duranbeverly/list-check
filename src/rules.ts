import { parsePhoneNumberFromString, validatePhoneNumberLength } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

// Keep success and failure results distinct for callers.
export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; why: 'missing' | 'too short' | 'not a valid number' };

// Normalize a phone number to the format used for texting.
export function cleanPhone(value: string, country: CountryCode = 'US'): PhoneResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { ok: false, why: 'missing' };
  }

  const parsedPhone = parsePhoneNumberFromString(trimmedValue, country);
  const lengthIssue = validatePhoneNumberLength(trimmedValue, country);

  if (!parsedPhone) {
    return { ok: false, why: lengthIssue === 'TOO_SHORT' ? 'too short' : 'not a valid number' };
  }

  if (!parsedPhone.isValid()) {
    if (!parsedPhone.isPossible() && lengthIssue === 'TOO_SHORT') {
      return { ok: false, why: 'too short' };
    }

    return { ok: false, why: 'not a valid number' };
  }

  return { ok: true, phone: parsedPhone.number };
}
