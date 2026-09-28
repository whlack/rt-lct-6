import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { AuthService, type AuthUser } from '../../auth/index.js';
import { PermissionService } from '../../permissions/services/permission.service.js';

@Injectable()
export class BackgroundIdentityService {
  constructor(
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}
  async resolve(subject: string, permission: string): Promise<AuthUser> {
    const identity = await this.directory.identity(subject);
    const level = this.auth.levelForRoles(identity.roles);
    if (!identity.enabled || !level)
      throw new ForbiddenException('CRM access revoked');
    const user: AuthUser = {
      id: await this.auth.ensureUser(subject),
      subject,
      level,
    };
    await this.permissions.require(user, permission);
    return user;
  }
}
