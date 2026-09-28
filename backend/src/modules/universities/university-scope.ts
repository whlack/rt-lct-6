import type { AuthUser } from '../auth/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

export function universityScope(user: AuthUser): Prisma.UniversityWhereInput {
  return user.level >= 20 ? {} : { assignments: { some: { userId: user.id } } };
}
