import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import { cleaned } from '../../../common/metrics.js';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(S3Adapter)
    private readonly storage: Pick<S3Adapter, 'delete' | 'oldTemporaryKeys'>,
  ) {}
  async run() {
    const expired = await this.database.prisma.exportJob.findMany({
      where: {
        expiresAt: { lte: new Date() },
        OR: [{ status: { not: 'EXPIRED' } }, { resultKey: { not: null } }],
      },
      take: 100,
    });
    for (const job of expired) {
      try {
        if (job.resultKey) {
          await this.storage.delete(job.resultKey);
          cleaned.inc({ kind: 'export' });
        }
        await this.database.prisma.$transaction([
          this.database.prisma.exportJobProject.deleteMany({
            where: { jobId: job.id },
          }),
          this.database.prisma.exportJob.update({
            where: { id: job.id },
            data: {
              status: 'EXPIRED',
              resultKey: null,
              parameters: {},
              fileName: null,
              executionId: null,
            },
          }),
        ]);
      } catch {
        this.logger.warn('EXPORT_CLEANUP_FAILED');
      }
    }
    const imports = await this.database.prisma.importJob.findMany({
      where: {
        expiresAt: { lte: new Date() },
        AND: [
          {
            OR: [
              { status: { not: 'RUNNING' } },
              { leaseUntil: { lt: new Date() } },
            ],
          },
        ],
        OR: [
          { status: { not: 'EXPIRED' } },
          { sourceKey: { not: null } },
          { resultKey: { not: null } },
        ],
      },
      take: 100,
    });
    for (const job of imports) {
      try {
        if (job.sourceKey) {
          await this.storage.delete(job.sourceKey);
          cleaned.inc({ kind: 'source' });
        }
        if (job.resultKey) {
          await this.storage.delete(job.resultKey);
          cleaned.inc({ kind: 'import' });
        }
        await this.database.prisma.$transaction([
          this.database.prisma.importRow.deleteMany({
            where: { jobId: job.id },
          }),
          this.database.prisma.importJob.update({
            where: { id: job.id },
            data: {
              status: 'EXPIRED',
              sourceKey: null,
              resultKey: null,
              fileName: 'expired',
              executionId: null,
            },
          }),
        ]);
      } catch {
        this.logger.warn('IMPORT_CLEANUP_FAILED');
      }
    }
    const before = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for await (const key of this.storage.oldTemporaryKeys(before)) {
      const referenced =
        (await this.database.prisma.exportJob.count({
          where: { resultKey: key },
        })) +
        (await this.database.prisma.importJob.count({
          where: { OR: [{ sourceKey: key }, { resultKey: key }] },
        }));
      if (!referenced) {
        await this.storage.delete(key);
        cleaned.inc({ kind: 'orphan' });
      }
    }
  }
}
