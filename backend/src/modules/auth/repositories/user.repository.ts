import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class UserRepository {
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
