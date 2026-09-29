export const sources = ['LMS', 'WEBSITE'] as const;
export type SyncSource = (typeof sources)[number];
export interface SyncContext {
  runId: string;
  signal: AbortSignal;
}
export interface SyncAdapter {
  readonly source: SyncSource;
  readonly availability: 'READY' | 'NOT_IMPLEMENTED';
  execute(context: SyncContext): Promise<void>;
}
export class SyncFailure extends Error {
  constructor(
    readonly code:
      | 'SOURCE_NOT_IMPLEMENTED'
      | 'INVALID_DATA'
      | 'ACCESS_UNAVAILABLE'
      | 'TEMPORARY_FAILURE',
    readonly retryable = false,
    readonly retryAfterMs = 0,
  ) {
    super(code);
    this.retryable = code === 'TEMPORARY_FAILURE' && retryable;
  }
}
export const SYNC_ADAPTERS = Symbol('SYNC_ADAPTERS');
