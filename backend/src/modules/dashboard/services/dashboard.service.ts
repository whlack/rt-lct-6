import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../auth/index.js';
import { DashboardRepository } from '../repositories/dashboard.repository.js';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DashboardRepository)
    private readonly repository: DashboardRepository,
  ) {}
  get(user: AuthUser) {
    return this.repository.counts(user);
  }
}
