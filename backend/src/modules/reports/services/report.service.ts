import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/index.js';
import { ReportRepository } from '../repositories/report.repository.js';
import type { ReportQueryDto } from '../dto/report-query.dto.js';
import { validateFilters } from '../report-filters.js';

@Injectable()
export class ReportService {
  constructor(
    @Inject(ReportRepository) private readonly repository: ReportRepository,
  ) {}
  list(user: AuthUser, query: ReportQueryDto) {
    validateFilters(query);
    return this.repository.list(user, query);
  }
  async detail(user: AuthUser, id: string) {
    const result = await this.repository.snapshot((tx) =>
      this.repository.detail(tx, user, id),
    );
    if (!result) throw new NotFoundException('Project not found');
    return result;
  }
}
