import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import type { AuthUser } from '../auth.types.js';
import { AuthService } from './auth.service.js';
import { VisibilityRepository } from '../repositories/visibility.repository.js';
import type { VisibilityDto } from '../dto/visibility.dto.js';

@Injectable()
export class VisibilityService {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
    @Inject(VisibilityRepository)
    private readonly repository: VisibilityRepository,
  ) {}
  private async target(actor: AuthUser, subject: string) {
    if (actor.level !== 30)
      throw new ForbiddenException('Administrator required');
    const identity = await this.directory.identity(subject);
    if (!identity.enabled || this.auth.levelForRoles(identity.roles) !== 10)
      throw new BadRequestException(
        'Visibility policy applies only to enabled KAM users',
      );
    return this.auth.ensureUser(subject);
  }
  async get(actor: AuthUser, subject: string) {
    return this.auth.visibilityFor(await this.target(actor, subject));
  }
  async set(actor: AuthUser, subject: string, policy: VisibilityDto) {
    const id = await this.target(actor, subject);
    if (
      policy.mode !== 'SELECTED' &&
      (policy.universityIds.length || policy.projectIds.length)
    )
      throw new BadRequestException('Explicit grants require SELECTED mode');
    try {
      await this.repository.set(id, policy);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2003'
      )
        throw new BadRequestException('University or project does not exist');
      throw error;
    }
    return this.auth.visibilityFor(id);
  }
}
