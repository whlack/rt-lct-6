import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository.js';
import type { AuthUser } from '../../auth/auth.types.js';

@Injectable()
export class PermissionService {
  constructor(
    @Inject(PermissionRepository)
    private readonly repository: PermissionRepository,
  ) {}

  async can(user: AuthUser, key: string): Promise<boolean> {
    // This bootstrap permission cannot be lowered through the database it protects.
    if (['permissions.manage', 'visibility.manage'].includes(key))
      return user.level === 30;
    const permission = await this.repository.find(key);
    return permission !== null && user.level >= permission.minimumLevel;
  }

  async require(user: AuthUser, key: string): Promise<void> {
    if (!(await this.can(user, key)))
      throw new ForbiddenException(`Permission ${key} required`);
  }

  list() {
    return this.repository.findAll();
  }

  async effectiveKeys(user: AuthUser): Promise<string[]> {
    const permissions = await this.repository.findAll();
    return permissions
      .filter((permission) =>
        ['permissions.manage', 'visibility.manage'].includes(permission.key)
          ? user.level === 30
          : user.level >= permission.minimumLevel,
      )
      .map((permission) => permission.key);
  }

  async update(key: string, minimumLevel: 10 | 20 | 30) {
    if (['permissions.manage', 'visibility.manage'].includes(key)) {
      if (minimumLevel !== 30)
        throw new ForbiddenException('Administrator level is required');
    }
    const current = await this.repository.find(key);
    if (!current) throw new NotFoundException('Permission not found');
    return this.repository.update(key, minimumLevel);
  }
}
