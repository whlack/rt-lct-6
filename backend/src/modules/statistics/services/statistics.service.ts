import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import type { AuthUser } from '../../auth/index.js';
import { JobsService, type ExportArtifact } from '../../jobs/index.js';
import { ReportFiltersDto, validateFilters } from '../../reports/index.js';
import {
  StatisticsRepository,
  months,
} from '../repositories/statistics.repository.js';
import { BrowserRenderer } from '../../../integrations/rendering/browser.adapter.js';
import { charts } from './charts.js';
import type { ExportJob } from '../../../generated/prisma/client.js';
import type { StatisticsExportDto } from '../controllers/statistics.controller.js';
@Injectable()
export class StatisticsService {
  constructor(
    @Inject(StatisticsRepository)
    private readonly repository: StatisticsRepository,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(BrowserRenderer) private readonly renderer: BrowserRenderer,
  ) {}
  async get(user: AuthUser, filters: ReportFiltersDto) {
    return (await this.repository.get(user, filters)).data;
  }
  create(user: AuthUser, body: StatisticsExportDto) {
    const { format, ...filters } = body;
    validateFilters(filters);
    months(filters);
    return this.jobs.createExport(user, {
      kind: 'STATISTICS',
      format,
      permission: 'statistics.read',
      parameters: Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined),
      ),
    });
  }
  async run(job: ExportJob, user: AuthUser): Promise<ExportArtifact> {
    if (!['png', 'pdf'].includes(job.format))
      throw new BadRequestException('Invalid chart format');
    const filters = plainToInstance(ReportFiltersDto, job.parameters);
    try {
      await validateOrReject(filters, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch {
      throw new BadRequestException('Invalid chart filters');
    }
    const result = await this.repository.get(user, filters);
    const bytes = await this.renderer.render(
      charts(result.data),
      job.format as 'png' | 'pdf',
      true,
    );
    return {
      bytes,
      projectIds: result.projectIds,
      mimeType: job.format === 'png' ? 'image/png' : 'application/pdf',
      fileName: 'statistics.' + job.format,
    };
  }
}
