import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class StatusService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: Pick<DatabaseService, 'isReady'>,
  ) {}

  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async ready(): Promise<{ status: 'ok' | 'unavailable' }> {
    return { status: (await this.database.isReady()) ? 'ok' : 'unavailable' };
  }
}
