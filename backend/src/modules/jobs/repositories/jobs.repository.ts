import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../database/database.service.js';
import { positiveInteger, artifactExpiry } from '../../../config/jobs.js';
import type { AuthUser } from '../../auth/index.js';
import { projectScope } from '../../projects/index.js';
import type { ExportInput, QueueKind } from '../job.types.js';

@Injectable()
export class JobsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  createExport(ownerId: string, input: ExportInput) {
    return this.database.prisma.$transaction(async (tx) => {
      // Count and enqueue under one lock; parallel requests cannot exceed the budget.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('crm-export-quota', 0))::text`;
      const active = {
        status: { in: ['QUEUED', 'RUNNING'] as Array<'QUEUED' | 'RUNNING'> },
        expiresAt: { gt: new Date() },
      };
      const [own, global, retained] = await Promise.all([
        tx.exportJob.count({ where: { ...active, ownerId } }),
        tx.exportJob.count({ where: active }),
        tx.exportJob.count({
          where: { ownerId, expiresAt: { gt: new Date() } },
        }),
      ]);
      if (
        own >= positiveInteger('MAX_ACTIVE_EXPORTS_PER_USER', 10) ||
        global >= positiveInteger('MAX_ACTIVE_EXPORTS', 200) ||
        retained >= positiveInteger('MAX_RETAINED_EXPORTS_PER_USER', 100)
      )
        throw new HttpException(
          'EXPORT_LIMIT_REACHED',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      return tx.exportJob.create({
        data: { ownerId, ...input, expiresAt: artifactExpiry() },
      });
    });
  }
  importWithOwner(id: string) {
    return this.database.prisma.importJob.findUniqueOrThrow({
      where: { id },
      include: { owner: true },
    });
  }
  exportWithOwner(id: string) {
    return this.database.prisma.exportJob.findUniqueOrThrow({
      where: { id },
      include: { owner: true },
    });
  }
  current(kind: QueueKind, id: string) {
    return kind === 'export'
      ? this.database.prisma.exportJob.findUnique({ where: { id } })
      : this.database.prisma.importJob.findUnique({ where: { id } });
  }
  async owned(id: string, ownerId: string) {
    const output = await this.database.prisma.exportJob.findFirst({
      where: { id, ownerId },
    });
    if (output) return { kind: 'export' as const, job: output };
    const input = await this.database.prisma.importJob.findFirst({
      where: { id, ownerId },
    });
    return input ? { kind: 'import' as const, job: input } : null;
  }
  async inaccessibleCount(jobId: string, user: AuthUser): Promise<number> {
    if (user.level >= 20 || user.visibility?.mode === 'ALL') return 0;
    return this.database.prisma.exportJobProject.count({
      where: { jobId, project: { NOT: projectScope(user) } },
    });
  }
  async pending() {
    // A worker can die on its final attempt before recording failure.
    const exhausted = {
      status: 'RUNNING' as const,
      attempts: { gte: 3 },
      leaseUntil: { lt: new Date() },
    };
    await Promise.all([
      this.database.prisma.exportJob.updateMany({
        where: exhausted,
        data: {
          status: 'FAILED',
          errorCode: 'RETRY_EXHAUSTED',
          completedAt: new Date(),
        },
      }),
      this.database.prisma.importJob.updateMany({
        where: exhausted,
        data: {
          status: 'FAILED',
          errorCode: 'RETRY_EXHAUSTED',
          completedAt: new Date(),
        },
      }),
    ]);
    const where = {
      OR: [
        { status: 'QUEUED' as const },
        { status: 'RUNNING' as const, leaseUntil: { lt: new Date() } },
      ],
    };
    const exports = await this.database.prisma.exportJob.findMany({
      where,
      select: { id: true, attempts: true, status: true },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });
    const imports = await this.database.prisma.importJob.findMany({
      where: { ...where, expiresAt: { gt: new Date() } },
      select: { id: true, attempts: true, status: true, phase: true },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });
    return [
      ...exports.map((j) => ({ ...j, kind: 'export' as const, phase: '' })),
      ...imports.map((j) => ({ ...j, kind: 'import' as const })),
    ];
  }
  async claim(kind: QueueKind, id: string) {
    const executionId = randomUUID();
    const where = {
      id,
      attempts: { lt: 3 },
      OR: [
        { status: 'QUEUED' as const },
        { status: 'RUNNING' as const, leaseUntil: { lt: new Date() } },
      ],
    };
    const data = {
      status: 'RUNNING' as const,
      executionId,
      startedAt: new Date(),
      leaseUntil: new Date(Date.now() + 15000),
      attempts: { increment: 1 },
      errorCode: null,
    };
    const result =
      kind === 'export'
        ? await this.database.prisma.exportJob.updateMany({ where, data })
        : await this.database.prisma.importJob.updateMany({ where, data });
    return result.count ? executionId : null;
  }
  async heartbeat(kind: QueueKind, id: string, executionId: string) {
    const where = {
      id,
      executionId,
      status: 'RUNNING' as const,
      leaseUntil: { gt: new Date() },
    };
    const data = { leaseUntil: new Date(Date.now() + 15000) };
    return kind === 'export'
      ? this.database.prisma.exportJob.updateMany({ where, data })
      : this.database.prisma.importJob.updateMany({ where, data });
  }
  async fail(
    kind: QueueKind,
    id: string,
    executionId: string,
    permanent: boolean,
    attempts: number,
    code: string,
  ) {
    const where = {
      id,
      executionId,
      status: 'RUNNING' as const,
      leaseUntil: { gt: new Date() },
    };
    const data = {
      status:
        permanent || attempts >= 3 ? ('FAILED' as const) : ('QUEUED' as const),
      errorCode: code,
      completedAt: permanent || attempts >= 3 ? new Date() : null,
      leaseUntil: null,
    };
    return kind === 'export'
      ? this.database.prisma.exportJob.updateMany({ where, data })
      : this.database.prisma.importJob.updateMany({ where, data });
  }
  async completeExport(
    id: string,
    executionId: string,
    result: {
      key: string;
      fileName: string;
      mimeType: string;
      size: number;
      projectIds: string[];
    },
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      const updated = await tx.exportJob.updateMany({
        where: {
          id,
          executionId,
          status: 'RUNNING',
          leaseUntil: { gt: new Date() },
        },
        data: {
          status: 'SUCCEEDED',
          progress: 100,
          completedAt: new Date(),
          expiresAt: artifactExpiry(),
          resultKey: result.key,
          fileName: result.fileName,
          mimeType: result.mimeType,
          size: result.size,
          leaseUntil: null,
        },
      });
      if (!updated.count) return false;
      await tx.exportJobProject.deleteMany({ where: { jobId: id } });
      await tx.exportJobProject.createMany({
        data: result.projectIds.map((projectId) => ({ jobId: id, projectId })),
        skipDuplicates: true,
      });
      return true;
    });
  }
}
