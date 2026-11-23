import { parsePhoneNumberFromString, validatePhoneNumberLength } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import type { ColumnMapping, DuplicateGroup, DuplicateKind, Member, PhoneResult, RawRow } from './types';

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

// Turn parsed rows into members while keeping their file positions and originals.
export function toMembers(rows: RawRow[], columns: ColumnMapping): Member[] {
  return rows.flatMap((original, index) => {
    const row = index + 2;
    if (isBlankRow(original)) {
      return [];
    }

    const readValue = (column: string | null) => (column ? (original[column] ?? '').trim() : '');

    return [{
      row,
      firstName: readValue(columns.firstName),
      lastName: readValue(columns.lastName),
      email: readValue(columns.email),
      phone: cleanPhone(readValue(columns.phone)),
      original,
    }];
  });
}

// Ignore only the short-row warning caused by a truly blank line.
export function findFatalParseError(
  errors: ReadonlyArray<{ code: string; row?: number }>,
  rows: RawRow[],
): { code: string; row?: number } | null {
  return errors.find((error) => {
    const row = error.row === undefined ? undefined : rows[error.row];
    return !(error.code === 'TooFewFields' && row !== undefined && isBlankRow(row));
  }) ?? null;
}

// Treat rows containing only blank cells as empty.
function isBlankRow(row: RawRow): boolean {
  return Object.values(row).every((value) => (value ?? '').trim() === '');
}

// Add each member to the group for a matching key.
function addToGroup(groups: Map<string, Member[]>, key: string, member: Member): void {
  const group = groups.get(key);
  if (group) {
    group.push(member);
  } else {
    groups.set(key, [member]);
  }
}

// Compare names without differences in case or Unicode composition.
function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize('NFC');
}

// Treat a phone group as one person only when both names are known and match.
function hasSameName(first: Member, second: Member): boolean {
  const firstName = normalizeText(first.firstName);
  const lastName = normalizeText(first.lastName);

  return firstName !== ''
    && lastName !== ''
    && firstName === normalizeText(second.firstName)
    && lastName === normalizeText(second.lastName);
}

// Keep duplicate output stable even when members arrive in a different order.
function compareText(first: string, second: string): number {
  if (first < second) {
    return -1;
  }
  if (first > second) {
    return 1;
  }
  return 0;
}

// Find repeated emails and phone numbers without merging any members.
export function findDuplicates(members: Member[]): DuplicateGroup[] {
  const emailGroups = new Map<string, Member[]>();
  const phoneGroups = new Map<string, Member[]>();

  for (const member of members) {
    const emailKey = normalizeText(member.email);
    if (emailKey) {
      addToGroup(emailGroups, emailKey, member);
    }

    if (member.phone.ok) {
      addToGroup(phoneGroups, member.phone.phone, member);
    }
  }

  const groups: DuplicateGroup[] = [];

  for (const [key, rows] of emailGroups) {
    if (rows.length >= 2) {
      groups.push({
        kind: 'same email',
        key,
        rows: [...rows].sort((first, second) => first.row - second.row),
      });
    }
  }

  for (const [key, rows] of phoneGroups) {
    if (rows.length >= 2) {
      const sortedRows = [...rows].sort((first, second) => first.row - second.row);
      const first = sortedRows[0];
      const kind: DuplicateKind = sortedRows.every((member) => hasSameName(first, member))
        ? 'same phone'
        : 'shared phone';

      groups.push({ kind, key, rows: sortedRows });
    }
  }

  return groups.sort((first, second) => {
    const firstRowOrder = first.rows[0].row - second.rows[0].row;
    if (firstRowOrder !== 0) {
      return firstRowOrder;
    }

    return compareText(first.kind, second.kind) || compareText(first.key, second.key);
  });
}
