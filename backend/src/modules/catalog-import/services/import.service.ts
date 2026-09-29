import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import { JobsService, QueueService } from '../../jobs/index.js';
import type { AuthUser } from '../../auth/index.js';
import { ImportRepository } from '../repositories/import.repository.js';
import { positiveInteger } from '../../../config/jobs.js';

@Injectable()
export class ImportService {
  constructor(
    @Inject(ImportRepository) private readonly repository: ImportRepository,
    @Inject(S3Adapter) private readonly storage: S3Adapter,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  async upload(user: AuthUser, file: Express.Multer.File) {
    if (
      !file ||
      !/\.(xls|xlsx)$/i.test(file.originalname) ||
      !file.size ||
      file.size > positiveInteger('IMPORT_MAX_BYTES', 10485760)
    )
      throw new BadRequestException('Expected XLS/XLSX within size limit');
    const key = 'imports/' + randomUUID();
    await this.storage.put(key, file.buffer, 'application/octet-stream');
    let job;
    try {
      job = await this.repository.create(
        user.id,
        file.originalname,
        key,
        createHash('sha256').update(file.buffer).digest('hex'),
      );
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }
    void this.queue.notify('import', job.id, 'VALIDATE');
    return { id: job.id, status: job.status };
  }
  async get(user: AuthUser, id: string, page: number, pageSize: number) {
    const owned = await this.jobs.owned(user, id);
    if (owned.kind !== 'import')
      throw new NotFoundException('Import not found');
    if (owned.job.expiresAt <= new Date())
      throw new GoneException('Import expired');
    const { rows, total } = await this.repository.page(id, page, pageSize);
    return {
      ...(await this.jobs.get(user, id)),
      phase: owned.job.phase,
      counts: owned.job.counts,
      rows,
      total,
      page,
      pageSize,
    };
  }
  async apply(user: AuthUser, id: string) {
    const owned = await this.jobs.owned(user, id);
    if (owned.kind !== 'import')
      throw new NotFoundException('Import not found');
    if (owned.job.expiresAt <= new Date())
      throw new GoneException('Import expired');
    if (
      owned.job.phase === 'APPLY' &&
      ['QUEUED', 'RUNNING', 'SUCCEEDED'].includes(owned.job.status)
    )
      return { id, status: owned.job.status };
    const result = await this.repository.beginApply(id, user.id);
    if (!result.count) throw new ConflictException('Import preview not ready');
    void this.queue.notify('import', id, 'APPLY');
    return { id, status: 'QUEUED' };
  }
}
