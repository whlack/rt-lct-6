import type { AuthUser } from '../auth/index.js';
import { Prisma } from '../../generated/prisma/client.js';

export function projectScope(user: AuthUser): Prisma.ProjectWhereInput {
  return user.level >= 20 || user.visibility?.mode === 'ALL'
    ? {}
    : user.visibility?.mode === 'SELECTED'
      ? {
          OR: [
            { id: { in: user.visibility.projectIds } },
            { universityId: { in: user.visibility.universityIds } },
          ],
        }
      : {
          OR: [
            { responsibleId: user.id },
            { university: { assignments: { some: { userId: user.id } } } },
          ],
        };
}

// SQL callers use the fixed alias p; values remain bound parameters.
export function projectScopeSql(user: AuthUser): Prisma.Sql {
  return user.level >= 20 || user.visibility?.mode === 'ALL'
    ? Prisma.sql`TRUE`
    : user.visibility?.mode === 'SELECTED'
      ? Prisma.sql`(p.id = ANY(${user.visibility.projectIds}::uuid[]) OR p.university_id = ANY(${user.visibility.universityIds}::uuid[]))`
      : Prisma.sql`(
    p.responsible_id = ${user.id}::uuid OR EXISTS (
      SELECT 1 FROM university_assignments a
      WHERE a.university_id = p.university_id AND a.user_id = ${user.id}::uuid
    )
  )`;
}
