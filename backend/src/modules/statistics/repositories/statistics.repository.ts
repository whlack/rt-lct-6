import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { AuthUser } from '../../auth/index.js';
import {
  reportWhere,
  reportBounds,
  reportTimezone,
  validateFilters,
  type ReportFiltersDto,
} from '../../reports/index.js';

export function months(filters: ReportFiltersDto, now = new Date()): string[] {
  validateFilters(filters);
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: reportTimezone(),
    year: 'numeric',
    month: '2-digit',
  }).format(now);
  const to = (filters.dateTo ?? local).slice(0, 7);
  const end = new Date(to + '-01T00:00:00Z');
  const start = filters.dateFrom
    ? new Date(filters.dateFrom.slice(0, 7) + '-01T00:00:00Z')
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  const result: string[] = [];
  for (
    const date = new Date(start);
    date <= end;
    date.setUTCMonth(date.getUTCMonth() + 1)
  ) {
    result.push(date.toISOString().slice(0, 7));
    if (result.length > 36)
      throw new BadRequestException('Monthly statistics limited to 36 months');
  }
  return result;
}
@Injectable()
export class StatisticsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  get(user: AuthUser, filters: ReportFiltersDto) {
    const buckets = months(filters);
    return this.database.prisma.$transaction(
      async (tx) => {
        const where = await reportWhere(tx, user, filters);
        const active = await tx.project.count({
          where: { AND: [where, { closedAt: null }] },
        });
        const closed = await tx.project.count({
          where: { AND: [where, { closedAt: { not: null } }] },
        });
        const distribution = await tx.project.groupBy({
          by: ['directionId'],
          where,
          _count: { _all: true },
        });
        const names = await tx.direction.findMany({
          where: { id: { in: distribution.map((d) => d.directionId) } },
          select: { id: true, name: true },
        });
        // The monthly chart uses lifecycle dates, not history membership in the report period.
        const first = filters.dateFrom ?? buckets[0] + '-01';
        const last =
          filters.dateTo ??
          new Date(
            Date.UTC(
              Number(buckets.at(-1)!.slice(0, 4)),
              Number(buckets.at(-1)!.slice(5)),
              0,
            ),
          )
            .toISOString()
            .slice(0, 10);
        const bounds = await reportBounds(tx, first, last);
        const lifecycle = await tx.project.findMany({
          where: {
            AND: [
              await reportWhere(tx, user, {
                ...filters,
                dateFrom: undefined,
                dateTo: undefined,
              }),
              {
                OR: [
                  { createdAt: { gte: bounds.start, lt: bounds.end } },
                  { closedAt: { gte: bounds.start, lt: bounds.end } },
                ],
              },
            ],
          },
          select: { id: true },
        });
        const ids = lifecycle.map((p) => p.id);
        const aggregates = ids.length
          ? await tx.$queryRaw<
              Array<{ month: string; kind: string; count: bigint }>
            >(Prisma.sql`
        WITH dates AS (
          SELECT created_at AS happened, 'created' AS kind FROM projects WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid)
          UNION ALL SELECT closed_at, 'closed' FROM projects WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid) AND closed_at IS NOT NULL
        )
        SELECT to_char(happened AT TIME ZONE 'UTC' AT TIME ZONE ${reportTimezone()}, 'YYYY-MM') AS month, kind, count(*) AS count
        FROM dates WHERE happened >= (${first}::date::timestamp AT TIME ZONE ${reportTimezone()}) AT TIME ZONE 'UTC'
        AND happened < ((${last}::date + 1)::timestamp AT TIME ZONE ${reportTimezone()}) AT TIME ZONE 'UTC'
        GROUP BY month, kind ORDER BY month
      `)
          : [];
        const included = await tx.project.findMany({
          where,
          select: { id: true },
        });
        return {
          data: {
            generatedAt: new Date().toISOString(),
            timezone: reportTimezone(),
            filters,
            status: { active, closed },
            directions: distribution
              .map((d) => ({
                id: d.directionId,
                name: names.find((n) => n.id === d.directionId)!.name,
                count: d._count._all,
              }))
              .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
            months: buckets.map((month) => ({
              month,
              created: Number(
                aggregates.find(
                  (a) => a.month === month && a.kind === 'created',
                )?.count ?? 0,
              ),
              closed: Number(
                aggregates.find((a) => a.month === month && a.kind === 'closed')
                  ?.count ?? 0,
              ),
            })),
          },
          projectIds: [...new Set([...ids, ...included.map((p) => p.id)])],
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 },
    );
  }
}
