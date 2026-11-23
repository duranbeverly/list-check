// Describe the phone-cleaning result without losing failure details.
export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; why: 'missing' | 'too short' | 'not a valid number' };

export type OptOutDecision = boolean | { needsReview: true; why: string };

// Keep the matched header names for each member detail.
export interface ColumnMapping {
  phone: string | null;
  email: string | null;
  optOut: string | null;
  firstName: string | null;
  lastName: string | null;
}

// Store each parsed row with its original file line and values.
export type RawRow = Record<string, string | undefined>;

export interface Member {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  optOut: string;
  phone: PhoneResult;
  original: RawRow;
}

export interface CheckedMember extends Member {
  reasons: string[];
}

export interface MemberBuckets {
  ready: CheckedMember[];
  needsReview: CheckedMember[];
  optedOut: CheckedMember[];
}

export type DuplicateKind = 'same email' | 'same phone' | 'shared phone';

export interface DuplicateGroup {
  kind: DuplicateKind;
  key: string;
  rows: Member[];
}
