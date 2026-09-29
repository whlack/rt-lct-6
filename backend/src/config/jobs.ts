import { Redis } from 'ioredis';
import { RedisConnection, createIORedisClient } from 'bullmq';

// BullMQ 6 cannot lazily require its optional Redis driver in native ESM.
// Its factory owns the connections, including blocking worker duplicates.
RedisConnection.clientFactory = (options) =>
  createIORedisClient(new Redis(options));

export function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(name + ' must be a positive integer');
  return value;
}
export function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://redis:6379/0');
  if (!['redis:', 'rediss:'].includes(url.protocol))
    throw new Error('Invalid REDIS_URL');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
export function artifactExpiry(): Date {
  return new Date(
    Date.now() + positiveInteger('JOB_RETENTION_HOURS', 24) * 3600000,
  );
}
