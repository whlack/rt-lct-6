import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { VisibilityPolicy } from '../auth.types.js';

@Injectable()
export class VisibilityRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async set(id: string, policy: VisibilityPolicy) {
    // A policy and its grants become visible together; requests never see a half-written list.
    await this.database.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.kamVisibleUniversity.deleteMany({ where: { userId: id } });
      await tx.kamVisibleProject.deleteMany({ where: { userId: id } });
      await tx.kamVisibleUniversity.createMany({
        data: policy.universityIds.map((universityId) => ({
          userId: id,
          universityId,
        })),
      });
      await tx.kamVisibleProject.createMany({
        data: policy.projectIds.map((projectId) => ({ userId: id, projectId })),
      });
      await tx.user.update({
        where: { id },
        data: { visibilityMode: policy.mode },
      });
    });
  }
}
