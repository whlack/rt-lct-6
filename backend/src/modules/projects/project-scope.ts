import type { AuthUser } from '../auth/index.js';
import { Prisma } from '../../generated/prisma/client.js';

export function projectScope(user: AuthUser): Prisma.ProjectWhereInput {
  return user.level >= 20
    ? {}
    : {
        OR: [
          { responsibleId: user.id },
          { university: { assignments: { some: { userId: user.id } } } },
        ],
      };
}

// SQL callers use the fixed alias p; values remain bound parameters.
export function projectScopeSql(user: AuthUser): Prisma.Sql {
  return user.level >= 20
    ? Prisma.sql`TRUE`
    : Prisma.sql`(
    p.responsible_id = ${user.id}::uuid OR EXISTS (
      SELECT 1 FROM university_assignments a
      WHERE a.university_id = p.university_id AND a.user_id = ${user.id}::uuid
    )
  )`;
}
