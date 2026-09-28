import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../auth/index.js';
import { JobsService } from '../../jobs/index.js';
import type { ExportRequestDto } from '../dto/export-request.dto.js';
import { validateFilters } from '../report-filters.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export function exportParameters(
  body: ExportRequestDto,
): Prisma.InputJsonObject {
  const { format, projectId, ...filters } = body;
  if (!format) throw new BadRequestException('Format required');
  validateFilters(filters);
  const entries = Object.entries(filters).filter(
    ([, value]) => value !== undefined,
  );
  if (projectId && entries.length)
    throw new BadRequestException('Full project report cannot have filters');
  return projectId ? { projectId } : Object.fromEntries(entries);
}
@Injectable()
export class ReportExportService {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  create(user: AuthUser, body: ExportRequestDto) {
    return this.jobs.createExport(user, {
      kind: body.projectId ? 'PROJECT' : 'SUMMARY',
      format: body.format,
      permission: 'reports.export',
      parameters: exportParameters(body),
    });
  }
}
