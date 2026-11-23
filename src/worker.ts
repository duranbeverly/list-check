// Decode, parse, map, and classify CSVs away from the main browser thread.
import Papa from 'papaparse';
import { guessColumns } from './columns';
import { decodeCsvBytes } from './csv';
import { MAX_CSV_ROWS, MAX_FILE_BYTES } from './limits';
import {
  checkList,
  findDuplicates,
  findFatalParseError,
  toMembers,
} from './rules';
import type { ColumnMapping, RawRow } from './types';
import type {
  ParsedList,
  WorkerRequest,
  WorkerResponse,
} from './workerProtocol';

interface ParsedCsvRow extends Record<string, string | string[] | undefined> {
  __parsed_extra?: string[];
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const workerScope = self as unknown as WorkerScope;
let currentList: ParsedList | null = null;
let currentRequestId = 0;

function respond(message: WorkerResponse) {
  workerScope.postMessage(message);
}

function getUniqueExtraHeaders(headers: string[], count: number): string[] {
  const used = new Set(headers.map((header) => header.trim().toLowerCase()));
  const extraHeaders: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const base = `Extra value ${index + 1}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base} (${suffix})`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    extraHeaders.push(candidate);
  }

  return extraHeaders;
}

function normalizeParsedRows(data: ParsedCsvRow[], headers: string[]) {
  const extraValues = data.map((row) => row.__parsed_extra ?? []);
  let maxExtraValues = 0;
  for (const values of extraValues) {
    maxExtraValues = Math.max(maxExtraValues, values.length);
  }
  const extraHeaders = getUniqueExtraHeaders(headers, maxExtraValues);
  const rows = data.map((row, rowIndex) => {
    const normalized: RawRow = {};
    for (const header of headers) {
      const value = row[header];
      normalized[header] = typeof value === 'string' ? value : '';
    }
    extraHeaders.forEach((header, index) => {
      normalized[header] = extraValues[rowIndex][index] ?? '';
    });
    return normalized;
  });
  const rowsWithExtraValues = new Set(
    extraValues.flatMap((values, index) => values.length > 0 ? [index] : []),
  );

  return {
    rows,
    headers: [...headers, ...extraHeaders],
    rowsWithExtraValues,
  };
}

function hasExcelSignature(bytes: Uint8Array): boolean {
  const isZip = bytes[0] === 0x50
    && bytes[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(bytes[2])
    && [0x04, 0x06, 0x08].includes(bytes[3]);
  const isOle = bytes[0] === 0xd0
    && bytes[1] === 0xcf
    && bytes[2] === 0x11
    && bytes[3] === 0xe0
    && bytes[4] === 0xa1
    && bytes[5] === 0xb1
    && bytes[6] === 0x1a
    && bytes[7] === 0xe1;
  return isZip || isOle;
}

function sendError(id: number, message: string) {
  currentList = null;
  respond({ id, type: 'error', message });
}

function createReport(columns: ColumnMapping, mappingMessage: string) {
  const list = currentList;
  if (!list) return;

  const members = toMembers(list.rows, columns, list.rowsWithExtraValues);
  const buckets = checkList(members, findDuplicates(members));
  currentList = { ...list, columns };
  respond({
    id: currentRequestId,
    type: 'result',
    metadata: {
      fileName: list.fileName,
      headers: list.headers,
      columns,
      encodingNote: list.encodingNote,
    },
    buckets,
    mappingMessage,
  });
}

function resolveOptOut(resolution: Extract<WorkerRequest, { type: 'resolve-opt-out' }>['resolution']) {
  const list = currentList;
  if (!list) {
    sendError(currentRequestId, 'Choose a file to check again.');
    return;
  }

  let columns: ColumnMapping;
  let mappingMessage: string;
  if (resolution.column === null && resolution.mode === 'none') {
    columns = {
      ...guessColumns(list.headers),
      optOut: null,
      optOutMode: 'none',
      optOutConfidence: 'confirmed',
    };
    mappingMessage = 'You confirmed this list has no opt-out column.';
  } else if (
    resolution.column !== null
    && list.headers.includes(resolution.column)
    && (resolution.mode === 'flag' || resolution.mode === 'status')
  ) {
    columns = {
      ...guessColumns(list.headers),
      optOut: resolution.column,
      optOutMode: resolution.mode,
      optOutConfidence: 'confirmed',
    };
    mappingMessage = `Using the ${resolution.column} column for opt-outs.`;
  } else {
    sendError(currentRequestId, 'Choose a valid opt-out column and interpretation.');
    return;
  }

  createReport(columns, mappingMessage);
}

interface NormalizedCsv {
  rows: RawRow[];
  headers: string[];
  rowsWithExtraValues: ReadonlySet<number>;
}

interface CsvRows {
  data: ParsedCsvRow[];
  fields: string[];
  errors: Array<{ code: string; row?: number }>;
  exceededLimit: boolean;
}

function parseCsvRows(text: string): CsvRows {
  const data: ParsedCsvRow[] = [];
  let fields: string[] = [];
  const errors: CsvRows['errors'] = [];
  let exceededLimit = false;

  Papa.parse<ParsedCsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ',',
    step(result, parser) {
      if (result.meta.fields) fields = result.meta.fields;
      if (data.length === MAX_CSV_ROWS) {
        exceededLimit = true;
        parser.abort();
        return;
      }
      data.push(result.data);
      errors.push(...result.errors);
    },
    complete(result) {
      if (result.meta.fields) fields = result.meta.fields;
    },
  });
  if (fields.length === 0) {
    fields = Papa.parse<string[]>(text, { preview: 1, delimiter: ',' }).data[0] ?? [];
  }
  return { data, fields, errors, exceededLimit };
}

function parseCsvText(text: string): NormalizedCsv | string {
  const results = parseCsvRows(text);
  if (results.exceededLimit) {
    return 'This file has more than 500,000 rows. Split it in two and try again.';
  }
  const parsed = normalizeParsedRows(results.data, results.fields);
  if (findFatalParseError(results.errors, parsed.rows)) {
    return 'Some rows do not match the column names. Fix the rows, then try again.';
  }
  if (parsed.headers.length === 0) {
    return 'This file is empty. Choose a file with a header row and people.';
  }
  if (parsed.headers.some((header) => header.includes(';'))) {
    return 'This file uses semicolons. Save it as comma-separated CSV and try again.';
  }
  if (parsed.headers.some((header) => header.includes('\t'))) {
    return 'This file uses tabs. Save it as comma-separated CSV and try again.';
  }
  return parsed;
}

function createParsedList(file: File, encodingNote: string, parsed: NormalizedCsv, id: number) {
  const columns = guessColumns(parsed.headers);
  if (!columns.phone && !columns.email) {
    sendError(
      id,
      `No phone or email column found. Columns in this file: ${parsed.headers.join(', ')}.`,
    );
    return;
  }

  currentList = {
    fileName: file.name,
    rows: parsed.rows,
    headers: parsed.headers,
    rowsWithExtraValues: parsed.rowsWithExtraValues,
    encodingNote,
    columns,
  };
  if (columns.optOutConfidence !== 'high') {
    respond({
      id,
      type: 'opt-out-needed',
      metadata: { fileName: file.name, headers: parsed.headers, columns, encodingNote },
    });
    return;
  }
  createReport(columns, `Using the ${columns.optOut} column for opt-outs.`);
}

async function readFileBytes(file: File, id: number): Promise<Uint8Array | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    sendError(id, 'Could not read this file. Check that it is a CSV file, then try again.');
    return null;
  }
  if (hasExcelSignature(bytes)) {
    sendError(id, 'This looks like an Excel file. Save it as CSV and try again.');
    return null;
  }
  return bytes;
}

async function processFile(file: File, id: number) {
  currentRequestId = id;
  currentList = null;
  if (file.size > MAX_FILE_BYTES) {
    sendError(id, 'This file is too big for your browser. Split it in two and try again.');
    return;
  }
  if (/\.(?:xls|xlsx|xlsm|xlsb)$/i.test(file.name)) {
    sendError(id, 'This looks like an Excel file. Save it as CSV and try again.');
    return;
  }

  const bytes = await readFileBytes(file, id);
  if (!bytes) return;
  const decoded = decodeCsvBytes(bytes);
  const parsed = parseCsvText(decoded.text);
  if (typeof parsed === 'string') {
    sendError(id, parsed);
    return;
  }
  const encodingNote = decoded.encoding === 'Windows-1252'
    ? 'This file was read as Windows-1252 to preserve names.'
    : '';
  createParsedList(file, encodingNote, parsed, id);
}

workerScope.onmessage = (event) => {
  if (event.data.type === 'process') {
    processFile(event.data.file, event.data.id).catch(() => {
      sendError(event.data.id, 'Could not check this file. Try a smaller CSV.');
    });
  } else {
    currentRequestId = event.data.id;
    resolveOptOut(event.data.resolution);
  }
};
