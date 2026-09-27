import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { AuthUser } from '../../auth/index.js';

@Injectable()
export class UniversityRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  list(user: AuthUser) {
    return this.database.prisma.university.findMany({
      where:
        user.level >= 20 ? {} : { assignments: { some: { userId: user.id } } },
      select: { id: true, name: true, primaryContactId: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  find(id: string) {
    return this.database.prisma.university.findUnique({
      where: { id },
      include: { assignments: { select: { userId: true } } },
    });
  }

  create(name: string, creatorId: string) {
    return this.database.prisma.university.create({
      data: {
        name,
        createdById: creatorId,
        assignments: { create: { userId: creatorId } },
      },
    });
  }

  update(id: string, name: string) {
    return this.database.prisma.university.update({
      where: { id },
      data: { name },
    });
  }

  listContacts(universityId: string) {
    return this.database.prisma.universityContact.findMany({
      where: { universityId },
      orderBy: { name: 'asc' },
    });
  }

  findContact(id: string) {
    return this.database.prisma.universityContact.findUnique({ where: { id } });
  }

  createContact(
    universityId: string,
    data: { name: string; email?: string; phone?: string },
  ) {
    return this.database.prisma.universityContact.create({
      data: { universityId, ...data },
    });
  }

  updateContact(
    id: string,
    data: { name: string; email?: string; phone?: string },
  ) {
    return this.database.prisma.universityContact.update({
      where: { id },
      data,
    });
  }

  setPrimaryContact(universityId: string, contactId: string) {
    return this.database.prisma.university.update({
      where: { id: universityId },
      data: { primaryContactId: contactId },
    });
  }

  assign(universityId: string, userId: string) {
    return this.database.prisma.universityAssignment.createMany({
      data: { universityId, userId },
      skipDuplicates: true,
    });
  }

  unassign(universityId: string, userId: string) {
    return this.database.prisma.universityAssignment.deleteMany({
      where: { universityId, userId },
    });
  }

  listAssignments(universityId: string) {
    return this.database.prisma.universityAssignment.findMany({
      where: { universityId },
      include: { user: { select: { keycloakSubject: true } } },
    });
  }
}
