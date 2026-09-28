import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ImportRepository } from '../repositories/import.repository.js';
import { parseWorkbook, type ParsedRow, type RowError } from '../workbook.js';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import { spreadsheet } from '../../../integrations/rendering/spreadsheet.js';
import type { AuthUser } from '../../auth/index.js';
import type {
  ImportJob,
  ImportRow,
  Prisma,
} from '../../../generated/prisma/client.js';

function counts(
  rows: { action: string; result?: string }[],
  applied = false,
): Prisma.InputJsonObject {
  const tally: Record<string, number> = { total: rows.length };
  for (const row of rows) {
    const key = applied ? (row.result ?? 'PENDING') : row.action;
    tally[key] = Number(tally[key] ?? 0) + 1;
  }
  return tally;
}
function prepared(row: ImportRow): ParsedRow {
  if (
    !row.data ||
    typeof row.data !== 'object' ||
    Array.isArray(row.data) ||
    !Array.isArray(row.errors)
  )
    throw new BadRequestException('Invalid stored row');
  const data: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row.data))
    if (typeof value === 'string' || typeof value === 'number')
      data[key] = value;
  return {
    sheet: row.sheet as ParsedRow['sheet'],
    rowNumber: row.rowNumber,
    key: row.key,
    data,
    action: row.action as ParsedRow['action'],
    errors: row.errors.flatMap((error) =>
      error &&
      typeof error === 'object' &&
      !Array.isArray(error) &&
      typeof error.code === 'string' &&
      typeof error.column === 'string' &&
      typeof error.message === 'string'
        ? [{ code: error.code, column: error.column, message: error.message }]
        : [],
    ),
  };
}

@Injectable()
export class ImportProcessor {
  constructor(
    @Inject(ImportRepository) private readonly repository: ImportRepository,
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: Pick<KeycloakDirectoryAdapter, 'findEmail'>,
    @Inject(S3Adapter)
    private readonly storage: Pick<S3Adapter, 'get' | 'put' | 'delete'>,
  ) {}
  private async employee(row: ParsedRow) {
    const people = await this.directory.findEmail(String(row.data.email));
    if (people.length !== 1)
      return {
        error: {
          column: 'Email',
          code: people.length ? 'AMBIGUOUS' : 'NOT_FOUND',
          message: people.length
            ? 'Неоднозначное совпадение email'
            : 'Сотрудник не найден в Keycloak',
        },
      };
    return { person: people[0] };
  }
  private async errorsFile(id: string, executionId: string, rows: ParsedRow[]) {
    const failed = rows.filter((row) => row.errors.length);
    const key = 'imports/' + id + '/' + executionId + '-errors.xlsx';
    const bytes = spreadsheet(
      {
        title: 'Ошибки импорта',
        generatedAt: new Date().toISOString(),
        timezone: process.env.REPORT_TIMEZONE ?? 'Europe/Moscow',
        sections: [
          {
            title: 'Ошибки',
            columns: ['Лист', 'Строка', 'Ключ', 'Ошибки'],
            rows: failed.map((row) => [
              row.sheet,
              row.rowNumber,
              row.key,
              row.errors.map((e) => e.column + ': ' + e.message).join('; '),
            ]),
          },
        ],
      },
      'xlsx',
    );
    await this.storage.put(
      key,
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return key;
  }
  async run(job: ImportJob, executionId: string, user: AuthUser) {
    const current = await this.repository.database.prisma.importJob.findFirst({
      where: { id: job.id, executionId, status: 'RUNNING', phase: job.phase },
    });
    if (!current) return;
    if (job.expiresAt <= new Date())
      throw new BadRequestException('Import expired');
    if (job.phase === 'VALIDATE') return this.validate(job, executionId, user);
    return this.apply(job, executionId, user);
  }
  private async validate(job: ImportJob, executionId: string, user: AuthUser) {
    if (!job.sourceKey) throw new BadRequestException('Import source missing');
    const bytes = Buffer.from(await this.storage.get(job.sourceKey));
    if (createHash('sha256').update(bytes).digest('hex') !== job.checksum)
      throw new BadRequestException('Import checksum mismatch');
    const rows = await parseWorkbook(bytes, job.fileName);
    for (const [index, row] of rows.entries()) {
      if (row.action !== 'ERROR' && !row.data.duplicateOf) {
        if (row.sheet === 'Сотрудники') {
          const match = await this.employee(row);
          if (match.error) {
            row.action = 'ERROR';
            row.errors.push(match.error);
          } else if (match.person) {
            const existing =
              await this.repository.database.prisma.user.findUnique({
                where: { keycloakSubject: match.person.subject },
              });
            row.action = !existing
              ? 'CREATE'
              : existing.displayNameOverride === row.data.fullName
                ? 'SKIP'
                : 'UPDATE';
          }
        } else rows[index] = await this.repository.preview(row, user);
      }
      if (index % 100 === 0)
        await this.repository.database.prisma.importJob.updateMany({
          where: { id: job.id, executionId, status: 'RUNNING' },
          data: {
            progress: Math.floor((index * 95) / Math.max(rows.length, 1)),
          },
        });
    }
    const key = await this.errorsFile(job.id, executionId, rows);
    try {
      if (
        !(await this.repository.savePreview(
          job.id,
          executionId,
          rows,
          counts(rows),
          key,
        ))
      )
        await this.storage.delete(key);
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }
  }
  private async apply(job: ImportJob, executionId: string, user: AuthUser) {
    const db = this.repository.database.prisma;
    const rows = await db.importRow.findMany({
      where: { jobId: job.id, processedAt: null },
      orderBy: { position: 'asc' },
    });
    const total = await db.importRow.count({ where: { jobId: job.id } });
    for (const [index, stored] of rows.entries()) {
      const row = prepared(stored);
      try {
        const match =
          row.sheet === 'Сотрудники' &&
          !row.errors.length &&
          !row.data.duplicateOf
            ? await this.employee(row)
            : undefined;
        if (match?.error) {
          await this.repository.rowError(stored.id, [match.error]);
          continue;
        }
        await db.$transaction(async (tx) => {
          // Lock the row and lease together: a duplicate delivery cannot apply a mutation twice.
          await tx.$queryRaw`SELECT id FROM import_jobs WHERE id = ${job.id} FOR UPDATE`;
          const owner = await tx.importJob.findFirst({
            where: {
              id: job.id,
              executionId,
              status: 'RUNNING',
              expiresAt: { gt: new Date() },
            },
          });
          if (!owner) throw new ConflictException('Import lease lost');
          await tx.$queryRaw`SELECT id FROM import_rows WHERE id = ${stored.id} FOR UPDATE`;
          const current = await tx.importRow.findUniqueOrThrow({
            where: { id: stored.id },
          });
          if (current.processedAt) return;
          let result = 'SKIPPED';
          if (row.errors.length) result = 'ERROR';
          else if (!row.data.duplicateOf) {
            if (match?.person) {
              const existing = await tx.user.findUnique({
                where: { keycloakSubject: match.person.subject },
              });
              await tx.user.upsert({
                where: { keycloakSubject: match.person.subject },
                create: {
                  keycloakSubject: match.person.subject,
                  email: match.person.email,
                  displayName: match.person.name,
                  displayNameOverride: String(row.data.fullName),
                },
                update: { displayNameOverride: String(row.data.fullName) },
              });
              result = !existing
                ? 'CREATED'
                : existing.displayNameOverride === row.data.fullName
                  ? 'SKIPPED'
                  : 'UPDATED';
            } else result = await this.repository.applyCatalog(tx, row, user);
          }
          await tx.importRow.update({
            where: { id: stored.id },
            data: { result, processedAt: new Date() },
          });
        });
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        const dataError =
          (error instanceof HttpException && error.getStatus() < 500) ||
          (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            ['P2002', 'P2003'].includes(String(error.code)));
        if (!dataError) throw error;
        const errors: RowError[] = [
          {
            column: '',
            code: 'ROW_REJECTED',
            message: 'Строка отклонена: изменились данные или доступ',
          },
        ];
        await this.repository.rowError(stored.id, errors);
      } finally {
        if (index % 100 === 0)
          await db.importJob.updateMany({
            where: { id: job.id, executionId, status: 'RUNNING' },
            data: {
              progress: Math.min(
                99,
                Math.floor(
                  ((total - rows.length + index + 1) * 100) /
                    Math.max(1, total),
                ),
              ),
            },
          });
      }
    }
    const completed = await db.importRow.findMany({
      where: { jobId: job.id },
      orderBy: { position: 'asc' },
    });
    const key = await this.errorsFile(
      job.id,
      executionId,
      completed.map(prepared),
    );
    const result = await db.importJob.updateMany({
      where: { id: job.id, executionId, status: 'RUNNING' },
      data: {
        status: 'SUCCEEDED',
        progress: 100,
        completedAt: new Date(),
        leaseUntil: null,
        counts: counts(completed, true),
        resultKey: key,
      },
    });
    if (!result.count) await this.storage.delete(key);
    else if (job.resultKey && job.resultKey !== key)
      await this.storage.delete(job.resultKey);
  }
}
