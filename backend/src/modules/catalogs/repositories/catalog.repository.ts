import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

export type CatalogKind = 'directions' | 'programs' | 'products';

@Injectable()
export class CatalogRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  list(kind: CatalogKind) {
    switch (kind) {
      case 'directions':
        return this.database.prisma.direction.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
      case 'programs':
        return this.database.prisma.program.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
      case 'products':
        return this.database.prisma.product.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
    }
  }

  create(kind: CatalogKind, name: string) {
    switch (kind) {
      case 'directions':
        return this.database.prisma.direction.create({
          data: { name },
          select: { id: true, name: true },
        });
      case 'programs':
        return this.database.prisma.program.create({
          data: { name },
          select: { id: true, name: true },
        });
      case 'products':
        return this.database.prisma.product.create({
          data: { name },
          select: { id: true, name: true },
        });
    }
  }

  update(kind: CatalogKind, id: string, name: string) {
    switch (kind) {
      case 'directions':
        return this.database.prisma.direction.update({
          where: { id },
          data: { name },
          select: { id: true, name: true },
        });
      case 'programs':
        return this.database.prisma.program.update({
          where: { id },
          data: { name },
          select: { id: true, name: true },
        });
      case 'products':
        return this.database.prisma.product.update({
          where: { id },
          data: { name },
          select: { id: true, name: true },
        });
    }
  }
}
