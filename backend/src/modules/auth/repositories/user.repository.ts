import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class UserRepository {
  async name(id: string) {
    const user = await this.database.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { displayName: true, displayNameOverride: true },
    });
    return user.displayNameOverride ?? user.displayName ?? undefined;
  }
  async employees(people: { subject: string; email: string; name: string }[]) {
    const users = await this.database.prisma.user.findMany({
      where: { keycloakSubject: { in: people.map((p) => p.subject) } },
      select: { keycloakSubject: true, displayNameOverride: true },
    });
    const overrides = new Map(
      users.map((u) => [u.keycloakSubject, u.displayNameOverride]),
    );
    return people.map((person) => ({
      ...person,
      name: overrides.get(person.subject) ?? person.name,
    }));
  }
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async ensure(
    subject: string,
    profile?: { name?: string; email?: string },
  ): Promise<string> {
    const user = await this.database.prisma.user.upsert({
      where: { keycloakSubject: subject },
      create: {
        keycloakSubject: subject,
        displayName: profile?.name,
        email: profile?.email,
      },
      update: { displayName: profile?.name, email: profile?.email },
      select: { id: true },
    });
    return user.id;
  }
}
