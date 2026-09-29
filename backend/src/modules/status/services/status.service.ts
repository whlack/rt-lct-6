import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class StatusService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: Pick<DatabaseService, 'isReady'>,
  ) {}

  publicConfig() {
    // An explicit allowlist prevents server credentials from entering browser configuration.
    return {
      keycloak: {
        url: process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:8080',
        realm: 'crm',
        clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'crm-web',
      },
    };
  }

  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async ready(): Promise<{ status: 'ok' | 'unavailable' }> {
    return { status: (await this.database.isReady()) ? 'ok' : 'unavailable' };
  }
}
