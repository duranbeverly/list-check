import Papa from 'papaparse';
import { parsePhoneNumberFromString, validatePhoneNumberLength } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import type {
  CheckedMember,
  ColumnMapping,
  DuplicateGroup,
  DuplicateKind,
  Member,
  MemberBuckets,
  OptOutDecision,
  OptOutMode,
  PhoneResult,
  RawRow,
} from './types';

// Normalize a phone number to the format used for texting.
export function cleanPhone(value: string, country: CountryCode = 'US'): PhoneResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { ok: false, why: 'missing' };
  }
  if (/^\d(?:\.\d+)?e\+\d+$/i.test(trimmedValue)) {
    return { ok: false, why: 'Excel shortened this number' };
  }
  if ((trimmedValue.match(/\+?\d[\d().\s-]{5,}\d/g) ?? []).length > 1) {
    return { ok: false, why: 'multiple numbers' };
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

  if (parsedPhone.ext) {
    return { ok: false, why: 'has extension' };
  }
  if (parsedPhone.country !== country) {
    return { ok: false, why: 'international number' };
  }

  return { ok: true, phone: parsedPhone.number };
}

// Never infer consent from an unfamiliar opt-out value.
export function isOptOut(value: string, mode: OptOutMode = 'flag'): OptOutDecision {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (mode === null) {
    return { needsReview: true, why: 'Opt-out column not confirmed.' };
  }
  if (mode === 'none') {
    return false;
  }

  if (mode === 'status') {
    if (['unsubscribed', 'unsubscribe', 'stopped', 'stop', 'opted out', 'opt out', 'do not text', 'do not contact', 'inactive'].includes(normalizedValue)) {
      return true;
    }
    if (['subscribed', 'active', 'opted in', 'subscribed to sms', 'opted in to sms'].includes(normalizedValue)) {
      return false;
    }

    return { needsReview: true, why: `Subscription status "${trimmedValue}" is unclear.` };
  }

  if (['yes', 'y', 'true', '1', 'stop', 'do not text', 'unsubscribe', 'unsubscribed', 'opted out', 'opt out'].includes(normalizedValue)) {
    return true;
  }

  if (['', 'no', 'n', 'false', '0'].includes(normalizedValue)) {
    return false;
  }

  return { needsReview: true, why: `Opt-out value "${trimmedValue}" is unclear.` };
}

// Turn parsed rows into members while keeping their file positions and originals.
export function toMembers(
  rows: RawRow[],
  columns: ColumnMapping,
  rowsWithExtraValues: ReadonlySet<number> = new Set(),
): Member[] {
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
      optOut: readValue(columns.optOut),
      optOutMode: columns.optOutMode,
      phone: columns.phone ? cleanPhone(readValue(columns.phone)) : null,
      hasExtraValues: rowsWithExtraValues.has(index),
      original,
    }];
  });
}

// Ignore warnings caused by blank lines or delimiter detection on an empty list.
export function findFatalParseError(
  errors: ReadonlyArray<{ code: string; row?: number }>,
  rows: RawRow[],
): { code: string; row?: number } | null {
  const hasData = rows.some((row) => !isBlankRow(row));
  return errors.find((error) => {
    if (error.code === 'TooManyFields') {
      return false;
    }
    if (error.code === 'UndetectableDelimiter' && !hasData) {
      return false;
    }

    const row = error.row === undefined ? undefined : rows[error.row];
    return !(error.code === 'TooFewFields' && row !== undefined && isBlankRow(row));
  }) ?? null;
}

// Treat rows containing only blank cells as empty.
function isBlankRow(row: RawRow): boolean {
  return Object.values(row).every((value) => (value ?? '').trim() === '');
}

// Add each member to the group for a matching key.
function addToGroup<T>(groups: Map<string, T[]>, key: string, item: T): void {
  const group = groups.get(key);
  if (group) {
    group.push(item);
  } else {
    groups.set(key, [item]);
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

    if (member.phone?.ok) {
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

// Put each member in exactly one safety bucket and explain the decision.
export function checkList(members: Member[], duplicateGroups: DuplicateGroup[]): MemberBuckets {
  const optOutByRow = new Map<number, OptOutDecision>();
  const optedOutRowsByPhone = new Map<string, number[]>();

  for (const member of members) {
    const decision = isOptOut(member.optOut, member.optOutMode);
    optOutByRow.set(member.row, decision);

    if (member.phone?.ok && decision === true) {
      addToGroup(optedOutRowsByPhone, member.phone.phone, member.row);
    }
  }

  const buckets: MemberBuckets = { ready: [], needsReview: [], optedOut: [] };

  for (const member of members) {
    const decision = optOutByRow.get(member.row) ?? {
      needsReview: true,
      why: 'Opt-out status could not be determined.',
    };
    const sharedOptOutRows = member.phone?.ok
      ? (optedOutRowsByPhone.get(member.phone.phone) ?? [])
        .filter((row) => row !== member.row)
        .sort((first, second) => first - second)
      : [];
    const reasons: string[] = [];

    if (member.phone && !member.phone.ok) {
      reasons.push(`phone ${member.phone.why}`);
    }
    if (member.hasExtraValues) {
      reasons.push('row has extra values');
    }
    if (decision !== true && typeof decision === 'object') {
      reasons.push(decision.why);
    }

    const memberGroups = duplicateGroups
      .filter((group) => group.rows.some((row) => row.row === member.row))
      .sort((first, second) => first.rows[0].row - second.rows[0].row
        || compareText(first.kind, second.kind)
        || compareText(first.key, second.key));

    for (const group of memberGroups) {
      const otherRows = group.rows
        .filter((row) => row.row !== member.row)
        .sort((first, second) => first.row - second.row);

      for (const other of otherRows) {
        const reason = group.kind === 'same email'
          ? `same email as row ${other.row}`
          : group.kind === 'same phone'
            ? `same phone as row ${other.row}`
            : `shared phone with row ${other.row}`;
        reasons.push(reason);
      }
    }

    if (decision === true) {
      reasons.push(`opted out: ${member.optOut.trim()}`);
    }
    for (const row of sharedOptOutRows) {
      reasons.push(`shared phone with opted-out row ${row}`);
    }

    const checkedMember = { ...member, reasons };
    if (decision === true || sharedOptOutRows.length > 0) {
      buckets.optedOut.push(checkedMember);
    } else if ((member.phone !== null && !member.phone.ok) || typeof decision === 'object' || reasons.length > 0) {
      buckets.needsReview.push(checkedMember);
    } else {
      buckets.ready.push(checkedMember);
    }
  }

  buckets.ready.sort((first, second) => first.row - second.row);
  buckets.needsReview.sort((first, second) => first.row - second.row);
  buckets.optedOut.sort((first, second) => first.row - second.row);

  return buckets;
}

// Keep review-table and CSV reasons in the same plain language.
export function formatReviewReason(reason: string): string {
  if (reason === 'phone too short') return 'Phone too short. Check the number.';
  if (reason === 'phone missing') return 'Phone missing. Add the number if available.';
  if (reason === 'phone not a valid number') return 'Phone is not valid. Check the number.';
  if (reason === 'phone has extension') return 'Likely a desk phone.';
  if (reason === 'phone Excel shortened this number') {
    return 'Excel shortened this number. Re-export the phone column as text.';
  }
  if (reason === 'phone international number') {
    return 'International number. Check your texting tool supports it.';
  }
  if (reason === 'phone multiple numbers') {
    return 'Two numbers in one cell. Keep one.';
  }
  if (reason === 'row has extra values') {
    return 'This row has extra values. Check the columns.';
  }

  const duplicateEmail = reason.match(/^same email as row (\d+)$/);
  if (duplicateEmail) return `Same email as row ${duplicateEmail[1]}. Keep one.`;

  const duplicatePhone = reason.match(/^same phone as row (\d+)$/);
  if (duplicatePhone) return `Same phone as row ${duplicatePhone[1]}. Confirm who uses it.`;

  const sharedOptOut = reason.match(/^shared phone with opted-out row (\d+)$/);
  if (sharedOptOut) {
    return `Phone shared with opted-out row ${sharedOptOut[1]}. Keep everyone on it out of texts.`;
  }

  const sharedPhone = reason.match(/^shared phone with row (\d+)$/);
  if (sharedPhone) return `Phone shared with row ${sharedPhone[1]}. Confirm who uses it.`;

  if (reason.startsWith('Opt-out value') || reason.startsWith('Subscription status')) {
    return `${reason.replace(/[.!?]+$/, '')}. Confirm permission before texting.`;
  }

  return `${reason.charAt(0).toUpperCase()}${reason.slice(1).replace(/[.!?]+$/, '')}.`;
}

// Add an apostrophe to spreadsheet formulas without changing clean phone numbers.
function escapeSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

// Export a checked bucket without changing its original columns or their order.
export function toCsv(bucket: CheckedMember[], headers: string[]): string {
  const usedHeaders = new Set(headers.map((header) => header.trim().toLowerCase()));

  const createColumnName = (name: string): string => {
    let candidate = name;
    if (usedHeaders.has(candidate.toLowerCase())) {
      candidate = `list_check_${name}`;
      let suffix = 2;
      while (usedHeaders.has(candidate.toLowerCase())) {
        candidate = `list_check_${name}_${suffix}`;
        suffix += 1;
      }
    }

    usedHeaders.add(candidate.toLowerCase());
    return candidate;
  };

  const findReusableColumn = (
    name: string,
    valueFor: (member: CheckedMember) => string,
  ): number => {
    const index = headers.findIndex((header) => header.trim().toLowerCase() === name);
    if (index === -1 || bucket.length === 0) return -1;

    return bucket.every(
      (member) => (member.original[headers[index]] ?? '') === valueFor(member),
    ) ? index : -1;
  };
  const phoneCleanIndex = findReusableColumn(
    'phone_clean',
    (member) => member.phone?.ok ? member.phone.phone : '',
  );
  const whyIndex = findReusableColumn(
    'why',
    (member) => member.reasons.map(formatReviewReason).join(' '),
  );
  const phoneCleanHeader = phoneCleanIndex === -1 ? createColumnName('phone_clean') : null;
  const whyHeader = whyIndex === -1 ? createColumnName('why') : null;
  const fields = [
    ...headers,
    ...(phoneCleanHeader ? [phoneCleanHeader] : []),
    ...(whyHeader ? [whyHeader] : []),
  ];
  const data = bucket.map((member) => {
    const phoneClean = member.phone?.ok ? member.phone.phone : '';
    const why = escapeSpreadsheetFormula(member.reasons.map(formatReviewReason).join(' '));
    const originalColumns = headers.map((header, index) => {
      if (index === phoneCleanIndex) return phoneClean;
      if (index === whyIndex) return why;
      return escapeSpreadsheetFormula(member.original[header] ?? '');
    });

    return [
      ...originalColumns,
      ...(phoneCleanIndex === -1 ? [phoneClean] : []),
      ...(whyIndex === -1 ? [why] : []),
    ];
  });
  const csv = Papa.unparse({ fields, data }, { escapeFormulae: false });

  return `\uFEFF${csv}`;
}
