import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class PermissionRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  findAll() {
    return this.database.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }

  find(key: string) {
    return this.database.prisma.permission.findUnique({ where: { key } });
  }

  update(key: string, minimumLevel: number) {
    return this.database.prisma.permission.update({
      where: { key },
      data: { minimumLevel },
    });
  }
}
