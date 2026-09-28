import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { redisConnection, positiveInteger } from '../config/jobs.js';
import {
  JobsRepository,
  BackgroundIdentityService,
  type QueueKind,
} from '../modules/jobs/index.js';
import { ReportExportProcessor } from '../modules/reports/index.js';
import { S3Adapter } from '../integrations/storage/s3.adapter.js';
import { CleanupService } from '../modules/jobs/index.js';
import { ImportProcessor } from '../modules/catalog-import/index.js';
import { StatisticsService } from '../modules/statistics/index.js';
import { errors, jobDuration, jobWait, retries } from '../common/metrics.js';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private exports?: Worker;
  private imports?: Worker;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(JobsRepository) private readonly jobs: JobsRepository,
    @Inject(BackgroundIdentityService)
    private readonly identities: BackgroundIdentityService,
    @Inject(ReportExportProcessor)
    private readonly reports: ReportExportProcessor,
    @Inject(S3Adapter) private readonly storage: S3Adapter,
    @Inject(CleanupService) private readonly cleanup: CleanupService,
    @Inject(ImportProcessor) private readonly catalogImports: ImportProcessor,
    @Inject(StatisticsService) private readonly statistics: StatisticsService,
  ) {}
  onModuleInit() {
    this.imports = new Worker(
      'crm-imports',
      (job) => this.process('import', job),
      {
        connection: redisConnection(),
        concurrency: positiveInteger('IMPORT_CONCURRENCY', 1),
      },
    );
    this.imports.on('error', () =>
      this.logger.warn('IMPORT_QUEUE_UNAVAILABLE'),
    );
    this.exports = new Worker(
      'crm-exports',
      (job) => this.process('export', job),
      {
        connection: redisConnection(),
        concurrency: positiveInteger('EXPORT_CONCURRENCY', 2),
      },
    );
    this.exports.on('error', () =>
      this.logger.warn('WORKER_QUEUE_UNAVAILABLE'),
    );
    this.cleanupTimer = setInterval(() => {
      void this.cleanup.run().catch(() => this.logger.warn('CLEANUP_FAILED'));
    }, 60000);
    this.cleanupTimer.unref();
  }
  async healthy() {
    if (!this.exports?.isRunning() || !this.imports?.isRunning()) return false;
    try {
      const result = await Promise.race([
        this.exports
          .getBackend()
          .client.then((client) => client.get('crm:health').then(() => 'PONG')),
        new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve('TIMEOUT'), 2000);
          timer.unref();
        }),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
  async process(kind: QueueKind, task: Job) {
    if (
      typeof task.data !== 'object' ||
      task.data === null ||
      typeof task.data.id !== 'string'
    )
      throw new UnrecoverableError('INVALID_JOB');
    const id: string = task.data.id;
    const started = performance.now();
    let outcome = 'SUCCEEDED';
    if (kind === 'import') {
      const input = await this.jobs.database.prisma.importJob.findUnique({
        where: { id },
      });
      if (input && task.data.phase !== input.phase) return;
    }
    const executionId = await this.jobs.claim(kind, id);
    if (!executionId) {
      const current = await this.current(kind, id);
      if (
        current?.status === 'SUCCEEDED' ||
        current?.status === 'PREVIEW' ||
        current?.status === 'EXPIRED' ||
        current?.status === 'FAILED'
      )
        return;
      throw new Error('JOB_LEASE_BUSY');
    }
    const heartbeat = setInterval(() => {
      void this.jobs
        .heartbeat(kind, id, executionId)
        .catch(() => this.logger.warn('LEASE_HEARTBEAT_FAILED'));
    }, 5000);
    let key: string | undefined;
    try {
      const attempt = await this.current(kind, id);
      if (attempt) {
        jobWait.observe(
          { kind },
          Math.max(0, Date.now() - attempt.createdAt.getTime()) / 1000,
        );
        if (attempt.attempts > 1) retries.inc({ kind });
      }
      if (kind === 'import') {
        const input =
          await this.jobs.database.prisma.importJob.findUniqueOrThrow({
            where: { id },
            include: { owner: true },
          });
        if (task.data.phase !== input.phase) return;
        const user = await this.identities.resolve(
          input.owner.keycloakSubject,
          'catalogs.import',
        );
        await this.catalogImports.run(input, executionId, user);
        this.logger.log({ jobId: id, result: 'IMPORT_COMPLETED' });
        return;
      }
      const job = await this.jobs.database.prisma.exportJob.findUniqueOrThrow({
        where: { id },
        include: { owner: true },
      });
      const user = await this.identities.resolve(
        job.owner.keycloakSubject,
        job.permission,
      );
      const result =
        job.kind === 'STATISTICS'
          ? await this.statistics.run(job, user)
          : await this.reports.run(job, user);
      key = 'exports/' + id + '/' + executionId + '.' + job.format;
      await this.storage.put(key, result.bytes, result.mimeType);
      const committed = await this.jobs.completeExport(id, executionId, {
        key,
        fileName: result.fileName,
        mimeType: result.mimeType,
        size: result.bytes.length,
        projectIds: result.projectIds,
      });
      if (!committed) await this.storage.delete(key);
      this.logger.log({
        jobId: id,
        result: committed ? 'SUCCEEDED' : 'LEASE_LOST',
      });
    } catch (error) {
      if (key)
        try {
          await this.storage.delete(key);
        } catch {
          this.logger.warn('ORPHAN_CLEANUP_FAILED');
        }
      const permanent =
        error instanceof HttpException && error.getStatus() < 500;
      const code = permanent
        ? error instanceof BadRequestException
          ? 'INVALID_DATA'
          : 'ACCESS_UNAVAILABLE'
        : 'TEMPORARY_FAILURE';
      outcome = code;
      errors.inc({ kind, code });
      const current = await this.current(kind, id);
      await this.jobs.fail(
        kind,
        id,
        executionId,
        permanent,
        current?.attempts ?? 3,
        code,
      );
      this.logger.warn({ jobId: id, result: code });
      if (permanent) throw new UnrecoverableError(code);
      throw new Error(code);
    } finally {
      clearInterval(heartbeat);
      jobDuration.observe(
        { kind, result: outcome },
        (performance.now() - started) / 1000,
      );
    }
  }
  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.exports?.close();
    await this.imports?.close();
  }
  private current(kind: QueueKind, id: string) {
    return kind === 'export'
      ? this.jobs.database.prisma.exportJob.findUnique({ where: { id } })
      : this.jobs.database.prisma.importJob.findUnique({ where: { id } });
  }
}
