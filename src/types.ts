// Describe the phone-cleaning result without losing failure details.
export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; why: 'missing' | 'too short' | 'not a valid number' };

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
  phone: PhoneResult;
  original: RawRow;
}

export type DuplicateKind = 'same email' | 'same phone' | 'shared phone';

export interface DuplicateGroup {
  kind: DuplicateKind;
  key: string;
  rows: Member[];
}
