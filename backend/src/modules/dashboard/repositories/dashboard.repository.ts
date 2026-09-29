import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { AuthUser } from '../../auth/index.js';
import { projectScopeSql } from '../../projects/index.js';
import { universityScope } from '../../universities/index.js';

@Injectable()
export class DashboardRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async counts(user: AuthUser) {
    return this.database.prisma.$transaction(
      async (tx) => {
        const universities = await tx.university.count({
          where: universityScope(user),
        });
        const [projects] = await tx.$queryRaw<
          Array<{ active: bigint; action: bigint }>
        >`
        SELECT COUNT(*) FILTER (WHERE p.closed_at IS NULL) AS active,
          COUNT(*) FILTER (WHERE p.closed_at IS NULL AND EXISTS (
            SELECT 1 FROM project_stages s WHERE s.project_id=p.id
            AND s.position=p.current_stage_index AND s.expected_actor='KAM'
          )) AS action
        FROM projects p WHERE ${projectScopeSql(user)}`;
        return {
          universities,
          activeProjects: Number(projects.active),
          actionRequiredProjects: Number(projects.action),
          calculatedAt: new Date(),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
