import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { databaseUrl } from '../config/env.js';
import { sqlDuration } from '../common/metrics.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
    log: [{ emit: 'event', level: 'query' }],
  });
  constructor() {
    this.prisma.$on('query', (event) =>
      sqlDuration.observe(event.duration / 1000),
    );
  }

  async isReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
