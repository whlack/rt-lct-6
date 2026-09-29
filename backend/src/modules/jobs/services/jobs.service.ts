import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/index.js';
import { PermissionService } from '../../permissions/services/permission.service.js';
import { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import { JobsRepository } from '../repositories/jobs.repository.js';
import { QueueService } from './queue.service.js';
import type { ExportInput } from '../job.types.js';
import { BackgroundIdentityService } from './background-identity.service.js';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JobsRepository)
    private readonly repository: Pick<
      JobsRepository,
      'createExport' | 'owned' | 'inaccessibleCount'
    >,
    @Inject(QueueService) private readonly queue: Pick<QueueService, 'notify'>,
    @Inject(PermissionService)
    private readonly permissions: Pick<PermissionService, 'require'>,
    @Inject(S3Adapter) private readonly storage: Pick<S3Adapter, 'get'>,
    @Inject(BackgroundIdentityService)
    private readonly identities: Pick<BackgroundIdentityService, 'resolve'>,
  ) {}
  async createExport(user: AuthUser, input: ExportInput) {
    await this.permissions.require(user, input.permission);
    const job = await this.repository.createExport(user.id, input);
    // PostgreSQL is the outbox: a disconnected Redis never loses the accepted request.
    void this.queue.notify('export', job.id);
    return { id: job.id, status: job.status };
  }
  async owned(user: AuthUser, id: string) {
    const result = await this.repository.owned(id, user.id);
    if (!result) throw new NotFoundException('Job not found');
    await this.permissions.require(
      user,
      result.kind === 'export' ? result.job.permission : 'catalogs.import',
    );
    return result;
  }
  async get(user: AuthUser, id: string) {
    const { job, kind } = await this.owned(user, id);
    return {
      id: job.id,
      kind,
      status:
        job.expiresAt && job.expiresAt <= new Date() ? 'EXPIRED' : job.status,
      progress: job.progress,
      errorCode: job.errorCode,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
    };
  }
  async file(user: AuthUser, id: string) {
    const result = await this.owned(user, id);
    const job = result.job;
    if (
      job.status === 'EXPIRED' ||
      (job.expiresAt && job.expiresAt <= new Date())
    )
      throw new GoneException('Job result expired');
    if (
      !job.resultKey ||
      (job.status !== 'SUCCEEDED' && job.status !== 'PREVIEW')
    )
      throw new ConflictException('Result not ready');
    const fresh = await this.identities.resolve(
      user.subject,
      result.kind === 'export' ? result.job.permission : 'catalogs.import',
    );
    if (
      result.kind === 'export' &&
      (await this.repository.inaccessibleCount(id, fresh))
    )
      throw new ForbiddenException(
        'Project visibility changed; create a new export',
      );
    return {
      bytes: Buffer.from(await this.storage.get(job.resultKey)),
      fileName:
        result.kind === 'export'
          ? (result.job.fileName ?? 'report')
          : 'import-errors.xlsx',
      mimeType:
        result.kind === 'export'
          ? (result.job.mimeType ?? 'application/octet-stream')
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
