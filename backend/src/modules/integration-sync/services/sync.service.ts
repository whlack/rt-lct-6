import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type IntegrationSyncRun,
} from '../../../generated/prisma/client.js';
import { syncInterval } from '../../../config/sync.js';
import { SyncRegistry } from './sync-registry.service.js';
import { SyncRepository } from '../repositories/sync.repository.js';
import type { AuthUser } from '../../auth/index.js';
import type { SyncSource } from '../../../integrations/sync-adapter.js';
import type { SyncPageDto } from '../dto/sync.dto.js';
export function syncRunView(run: IntegrationSyncRun) {
  // Only this projection reaches API: leases, execution IDs and user profiles are private.
  return {
    id: run.id,
    source: run.source,
    trigger: run.trigger,
    initiatorId: run.initiatorId,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    attempts: run.attempts,
    nextAttemptAt: run.status === 'QUEUED' ? run.nextAttemptAt : null,
    errorCode: run.errorCode,
    scheduledAt: run.scheduledAt,
  };
}
export function syncSlot(now: Date, intervalSeconds: number): Date {
  const interval = intervalSeconds * 1000;
  return new Date(Math.floor(now.getTime() / interval) * interval);
}
@Injectable()
export class SyncService {
  constructor(
    @Inject(SyncRegistry) private readonly registry: SyncRegistry,
    @Inject(SyncRepository) private readonly repository: SyncRepository,
  ) {}
  async states(now = new Date()) {
    return Promise.all(
      this.registry.all().map(async (adapter) => {
        const intervalSeconds = syncInterval(adapter.source);
        const latest = await this.repository.latest(adapter.source);
        return {
          source: adapter.source,
          availability: adapter.availability,
          reason:
            adapter.availability === 'NOT_IMPLEMENTED'
              ? 'SOURCE_NOT_IMPLEMENTED'
              : null,
          intervalSeconds,
          nextRunAt:
            adapter.availability === 'READY'
              ? new Date(
                  syncSlot(now, intervalSeconds).getTime() +
                    intervalSeconds * 1000,
                )
              : null,
          lastRun: latest ? syncRunView(latest) : null,
        };
      }),
    );
  }
  async start(source: string, user: AuthUser) {
    const adapter = this.registry.get(source);
    if (adapter.availability !== 'READY')
      throw new ConflictException('SOURCE_NOT_IMPLEMENTED');
    try {
      const run = await this.repository.create(adapter.source, user.id);
      return { runId: run.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('SYNC_ALREADY_ACTIVE');
      throw error;
    }
  }
  async list(source: string, query: SyncPageDto) {
    const result = await this.repository.list(
      this.registry.source(source),
      query.page,
      query.pageSize,
    );
    return { ...result, rows: result.rows.map(syncRunView) };
  }
  async get(source: string, id: string) {
    const run = await this.repository.get(this.registry.source(source), id);
    if (!run) throw new NotFoundException('SYNC_RUN_NOT_FOUND');
    return syncRunView(run);
  }
  async schedule(now = new Date()) {
    for (const adapter of this.registry.all()) {
      if (adapter.availability !== 'READY') continue;
      const source: SyncSource = adapter.source;
      try {
        // Current time slot only: downtime never creates a backlog of missed hours.
        await this.repository.create(
          source,
          null,
          syncSlot(now, syncInterval(source)),
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          continue;
        throw error;
      }
    }
  }
}
