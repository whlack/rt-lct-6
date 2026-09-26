import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { databaseUrl } from '../config/env.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  });

  async isReady(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
