import { positiveInteger } from './jobs.js';
import type { SyncSource } from '../integrations/sync-adapter.js';
export function syncInterval(source: SyncSource): number {
  return positiveInteger(source + '_SYNC_INTERVAL_SECONDS', 3600);
}
export function syncRetentionDays(): number {
  return positiveInteger('SYNC_RUN_RETENTION_DAYS', 90);
}
// Durable DB leases outlive brief queue disconnects; stale executors must not commit.
export const syncLeaseMs = 30000;
