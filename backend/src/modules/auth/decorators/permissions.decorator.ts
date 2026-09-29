import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequireAnyPermission = (...keys: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, keys);
export const RequirePermission = (key: string) => RequireAnyPermission(key);
