import type { ColumnMapping } from './types';

// Keep preferred header names first so matches are predictable.
const HEADER_ALIASES = {
  phone: ['phone', 'cell', 'cell phone', 'mobile', 'mobile phone', 'phone number', 'telephone', 'telephone number'],
  email: ['email', 'e-mail', 'email address'],
  optOut: ['opt_out', 'opt out', 'opt-out', 'optout', 'unsubscribe', 'do not contact', 'do not text'],
  firstName: ['first_name', 'first name', 'first', 'given name'],
  lastName: ['last_name', 'last name', 'last', 'surname', 'family name'],
} as const;

// Match cleaned names while keeping the original header for later use.
function findHeader(headers: string[], aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const match = headers.find((header) => header.trim().toLowerCase() === alias);
    if (match !== undefined) {
      return match;
    }
  }

  return null;
}

// Return the matching header for each role, or null when none is found.
export function guessColumns(headers: string[]): ColumnMapping {
  return {
    phone: findHeader(headers, HEADER_ALIASES.phone),
    email: findHeader(headers, HEADER_ALIASES.email),
    optOut: findHeader(headers, HEADER_ALIASES.optOut),
    firstName: findHeader(headers, HEADER_ALIASES.firstName),
    lastName: findHeader(headers, HEADER_ALIASES.lastName),
  };
}
