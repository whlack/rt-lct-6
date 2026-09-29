import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../database/database.service.js';
import { syncLeaseMs, syncRetentionDays } from '../../../config/sync.js';
import type { SyncSource } from '../../../integrations/sync-adapter.js';
@Injectable()
export class SyncRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  create(
    source: SyncSource,
    initiatorId: string | null,
    scheduledAt: Date | null = null,
  ) {
    return this.database.prisma.integrationSyncRun.create({
      data: {
        source,
        initiatorId,
        scheduledAt,
        trigger: scheduledAt ? 'SCHEDULED' : 'MANUAL',
      },
    });
  }
  get(source: SyncSource, id: string) {
    return this.database.prisma.integrationSyncRun.findFirst({
      where: { source, id },
    });
  }
  find(id: string) {
    return this.database.prisma.integrationSyncRun.findUnique({
      where: { id },
      include: { initiator: { select: { keycloakSubject: true } } },
    });
  }
  latest(source: SyncSource) {
    return this.database.prisma.integrationSyncRun.findFirst({
      where: { source },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
  async list(source: SyncSource, page: number, pageSize: number) {
    const [rows, total] = await this.database.prisma.$transaction([
      this.database.prisma.integrationSyncRun.findMany({
        where: { source },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.prisma.integrationSyncRun.count({ where: { source } }),
    ]);
    return { rows, total, page, pageSize };
  }
  async pending(now = new Date()) {
    await this.database.prisma.integrationSyncRun.updateMany({
      where: {
        status: 'RUNNING',
        leaseUntil: { lte: now },
        attempts: { gte: 3 },
      },
      data: {
        status: 'FAILED',
        completedAt: now,
        errorCode: 'RETRY_EXHAUSTED',
        leaseUntil: null,
      },
    });
    return this.database.prisma.integrationSyncRun.findMany({
      where: {
        attempts: { lt: 3 },
        OR: [
          { status: 'QUEUED', nextAttemptAt: { lte: now } },
          { status: 'RUNNING', leaseUntil: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
  delivered(id: string) {
    return this.database.prisma.integrationSyncRun.updateMany({
      // Completion may win the race after queue.add; delivery remains an audit fact.
      where: { id },
      data: { deliveredAt: new Date() },
    });
  }
  async claim(id: string, now = new Date()) {
    const executionId = randomUUID();
    const result = await this.database.prisma.integrationSyncRun.updateMany({
      where: {
        id,
        attempts: { lt: 3 },
        OR: [
          { status: 'QUEUED', nextAttemptAt: { lte: now } },
          { status: 'RUNNING', leaseUntil: { lte: now } },
        ],
      },
      data: {
        status: 'RUNNING',
        executionId,
        leaseUntil: new Date(now.getTime() + syncLeaseMs),
        startedAt: now,
        attempts: { increment: 1 },
        errorCode: null,
      },
    });
    return result.count ? executionId : null;
  }
  heartbeat(id: string, executionId: string) {
    const now = new Date();
    return this.database.prisma.integrationSyncRun.updateMany({
      where: { id, executionId, status: 'RUNNING', leaseUntil: { gt: now } },
      data: { leaseUntil: new Date(now.getTime() + syncLeaseMs) },
    });
  }
  complete(id: string, executionId: string) {
    const now = new Date();
    return this.database.prisma.integrationSyncRun.updateMany({
      where: { id, executionId, status: 'RUNNING', leaseUntil: { gt: now } },
      data: {
        status: 'SUCCEEDED',
        completedAt: now,
        leaseUntil: null,
        errorCode: null,
      },
    });
  }
  fail(
    id: string,
    executionId: string,
    attempts: number,
    retryable: boolean,
    code: string,
    retryAfterMs = 0,
  ) {
    const now = new Date();
    const terminal = !retryable || attempts >= 3;
    return this.database.prisma.integrationSyncRun.updateMany({
      where: { id, executionId, status: 'RUNNING', leaseUntil: { gt: now } },
      data: {
        status: terminal ? 'FAILED' : 'QUEUED',
        completedAt: terminal ? now : null,
        errorCode: code,
        leaseUntil: null,
        deliveredAt: null,
        nextAttemptAt: new Date(
          now.getTime() +
            Math.max(attempts === 1 ? 10000 : 20000, retryAfterMs),
        ),
      },
    });
  }
  cleanup(now = new Date()) {
    return this.database.prisma.integrationSyncRun.deleteMany({
      where: {
        status: { in: ['SUCCEEDED', 'FAILED'] },
        completedAt: {
          lt: new Date(now.getTime() - syncRetentionDays() * 86400000),
        },
      },
    });
  }
}
