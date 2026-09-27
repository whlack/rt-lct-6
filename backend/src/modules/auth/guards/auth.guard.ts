import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service.js';
import { PermissionService } from '../../permissions/services/permission.service.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { REQUIRED_PERMISSIONS } from '../decorators/permissions.decorator.js';
import type { AuthRequest } from '../auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Bearer token required');
    request.user = await this.auth.authenticate(header.slice(7));
    const keys = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (
      keys?.length &&
      !(
        await Promise.all(
          keys.map((key) => this.permissions.can(request.user!, key)),
        )
      ).some(Boolean)
    ) {
      throw new ForbiddenException('Permission required');
    }
    return true;
  }
}
