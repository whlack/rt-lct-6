import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { KeycloakTokenAdapter } from '../../../integrations/keycloak/token.adapter.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { AuthUser } from '../auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(KeycloakTokenAdapter)
    private readonly tokens: Pick<KeycloakTokenAdapter, 'verify'>,
    @Inject(UserRepository)
    private readonly users: Pick<
      UserRepository,
      'ensure' | 'name' | 'visibility'
    >,
  ) {}

  async authenticate(token: string): Promise<AuthUser> {
    const payload = await this.tokens.verify(token);
    const roles = payload.realm_access?.roles ?? [];
    const level = this.levelForRoles(roles);
    if (!level || !payload.sub) {
      throw new UnauthorizedException('CRM role is required');
    }
    const id = await this.users.ensure(payload.sub, {
      name: payload.name,
      email: payload.email,
    });
    return {
      id,
      subject: payload.sub,
      level,
      email: payload.email,
      name: await this.users.name(id),
      visibility: await this.users.visibility(id),
    };
  }

  levelForRoles(roles: string[]): 10 | 20 | 30 | null {
    if (roles.includes(process.env.KEYCLOAK_ADMIN_ROLE ?? 'admin')) return 30;
    if (roles.includes(process.env.KEYCLOAK_SUPERVISOR_ROLE ?? 'supervisor'))
      return 20;
    if (roles.includes(process.env.KEYCLOAK_KAM_ROLE ?? 'kam')) return 10;
    return null;
  }

  visibilityFor(id: string) {
    return this.users.visibility(id);
  }

  ensureUser(subject: string): Promise<string> {
    return this.users.ensure(subject);
  }
}
