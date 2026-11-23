// Share the typed message contract between the page and processing Worker.
import type { ColumnMapping, MemberBuckets, RawRow } from './types';

export type OptOutResolution =
  | { column: string; mode: 'flag' | 'status' }
  | { column: null; mode: 'none' };

export type WorkerRequest =
  | { id: number; type: 'process'; file: File }
  | { id: number; type: 'resolve-opt-out'; resolution: OptOutResolution };

export interface WorkerMetadata {
  fileName: string;
  headers: string[];
  columns: ColumnMapping;
  encodingNote: string;
}

export type WorkerResponse =
  | { id: number; type: 'opt-out-needed'; metadata: WorkerMetadata }
  | {
    id: number;
    type: 'result';
    metadata: WorkerMetadata;
    buckets: MemberBuckets;
    mappingMessage: string;
  }
  | { id: number; type: 'error'; message: string };

export interface ParsedList {
  fileName: string;
  rows: RawRow[];
  headers: string[];
  rowsWithExtraValues: ReadonlySet<number>;
  encodingNote: string;
  columns: ColumnMapping;
}
