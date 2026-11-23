import type { ColumnMapping } from './types';

// Match normalized header names while retaining each source's original spelling.
const HEADER_ALIASES = {
  phone: [
    'phone',
    'cell',
    'cell phone',
    'mobile',
    'mobile phone',
    'phone mobile',
    'phone number',
    'telephone',
    'telephone number',
  ],
  email: ['email', 'e mail', 'email address'],
  optOutFlag: [
    'opt out',
    'optout',
    'sms opt out',
    'text opt out',
    'unsubscribe',
    'do not contact',
    'do not text',
  ],
  optOutStatus: [
    'opt out status',
    'sms opt out status',
    'text opt out status',
    'sms status',
    'text status',
    'sms subscription status',
    'text subscription status',
    'subscription status',
  ],
  firstName: ['first name', 'first', 'given name'],
  lastName: ['last name', 'last', 'surname', 'family name'],
} as const;

const VENDOR_PREFIXES = [
  'action network',
  'solidarity tech',
  'mailchimp',
  'can2',
  'van',
] as const;

export function normalizeHeader(header: string): string {
  let normalized = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  for (const prefix of VENDOR_PREFIXES) {
    if (normalized.startsWith(`${prefix} `)) {
      normalized = normalized.slice(prefix.length + 1);
      break;
    }
  }

  return normalized;
}

function findHeader(headers: string[], aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const match = headers.find((header) => normalizeHeader(header) === alias);
    if (match !== undefined) {
      return match;
    }
  }

  return null;
}

export function inferOptOutMode(header: string): 'flag' | 'status' {
  return normalizeHeader(header).split(' ').includes('status') ? 'status' : 'flag';
}

// Return the matching header for each role, or null when none is found.
export function guessColumns(headers: string[]): ColumnMapping {
  const optOutFlag = findHeader(headers, HEADER_ALIASES.optOutFlag);
  const optOutStatus = findHeader(headers, HEADER_ALIASES.optOutStatus);
  const suggestedOptOut = headers.find((header) => {
    const words = normalizeHeader(header).split(' ');
    return (words.includes('opt') && words.includes('out'))
      || ((words.includes('sms') || words.includes('text')) && words.includes('status'));
  }) ?? null;
  const optOut = optOutFlag ?? optOutStatus ?? suggestedOptOut;

  return {
    phone: findHeader(headers, HEADER_ALIASES.phone),
    email: findHeader(headers, HEADER_ALIASES.email),
    optOut,
    optOutMode: optOut ? inferOptOutMode(optOut) : null,
    optOutConfidence: optOutFlag || optOutStatus
      ? 'high'
      : suggestedOptOut
        ? 'suggested'
        : 'none',
    firstName: findHeader(headers, HEADER_ALIASES.firstName),
    lastName: findHeader(headers, HEADER_ALIASES.lastName),
  };
}
