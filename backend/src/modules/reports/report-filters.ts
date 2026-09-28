import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../auth/index.js';
import { projectScope } from '../projects/index.js';
import type { ReportFiltersDto } from './dto/report-query.dto.js';

export function reportTimezone(): string {
  const zone = process.env.REPORT_TIMEZONE ?? 'Europe/Moscow';
  new Intl.DateTimeFormat('en', { timeZone: zone });
  return zone;
}
function validDate(value: string): boolean {
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateFilters(filters: ReportFiltersDto): void {
  if (!!filters.dateFrom !== !!filters.dateTo)
    throw new BadRequestException('Both dateFrom and dateTo are required');
  if (
    filters.dateFrom &&
    filters.dateTo &&
    (!validDate(filters.dateFrom) ||
      !validDate(filters.dateTo) ||
      filters.dateFrom > filters.dateTo)
  ) {
    throw new BadRequestException('Invalid date range');
  }
  if (filters.programId && filters.productId)
    throw new BadRequestException('Select program or product, not both');
}
export async function reportBounds(
  tx: Prisma.TransactionClient,
  dateFrom: string,
  dateTo: string,
) {
  const [bounds] = await tx.$queryRaw<Array<{ start: Date; end: Date }>>`SELECT
      ${dateFrom}::date::timestamp AT TIME ZONE ${reportTimezone()} AS start,
      (${dateTo}::date + 1)::timestamp AT TIME ZONE ${reportTimezone()} AS "end"`;
  return bounds;
}

export async function reportWhere(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  filters: ReportFiltersDto,
): Promise<Prisma.ProjectWhereInput> {
  validateFilters(filters);
  let events: Prisma.ProjectWhereInput = {};
  if (filters.dateFrom && filters.dateTo) {
    const bounds = await reportBounds(tx, filters.dateFrom, filters.dateTo);
    events = {
      events: { some: { createdAt: { gte: bounds.start, lt: bounds.end } } },
    };
  }
  return {
    AND: [
      projectScope(user),
      events,
      {
        universityId: filters.universityId,
        directionId: filters.directionId,
        programId: filters.programId,
        productId: filters.productId,
        responsible: filters.responsibleSubject
          ? { keycloakSubject: filters.responsibleSubject }
          : undefined,
        closedAt:
          filters.status === 'ACTIVE'
            ? null
            : filters.status === 'CLOSED'
              ? { not: null }
              : undefined,
      },
    ],
  };
}
