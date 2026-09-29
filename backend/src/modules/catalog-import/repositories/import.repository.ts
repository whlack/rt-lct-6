import type { Employee } from '../../../integrations/keycloak/directory.adapter.js';
import {
  Inject,
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { AuthUser } from '../../auth/index.js';
import { universityScope } from '../../universities/index.js';
import { catalogKey } from '../../../common/catalog-name.js';
import type { ParsedRow, RowError } from '../workbook.js';
import { positiveInteger, artifactExpiry } from '../../../config/jobs.js';

@Injectable()
export class ImportRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  create(
    ownerId: string,
    fileName: string,
    sourceKey: string,
    checksum: string,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('crm-import-quota/' || ${ownerId}, 0))::text`;
      const [active, retained] = await Promise.all([
        tx.importJob.count({
          where: {
            ownerId,
            status: { in: ['QUEUED', 'RUNNING', 'PREVIEW'] },
            expiresAt: { gt: new Date() },
          },
        }),
        tx.importJob.count({
          where: { ownerId, expiresAt: { gt: new Date() } },
        }),
      ]);
      if (
        active >= positiveInteger('MAX_ACTIVE_IMPORTS_PER_USER', 2) ||
        retained >= positiveInteger('MAX_RETAINED_IMPORTS_PER_USER', 10)
      )
        throw new HttpException(
          'IMPORT_LIMIT_REACHED',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      return tx.importJob.create({
        data: {
          ownerId,
          fileName,
          sourceKey,
          checksum,
          expiresAt: artifactExpiry(),
        },
      });
    });
  }
  async preview(row: ParsedRow, user: AuthUser): Promise<ParsedRow> {
    if (row.action === 'ERROR' || row.data.duplicateOf) return row;
    const name = String(row.data.name);
    const normalizedName = catalogKey(name);
    const db = this.database.prisma;
    const existing =
      row.sheet === 'Вузы'
        ? await db.university.findUnique({ where: { normalizedName } })
        : row.sheet === 'Направления'
          ? await db.direction.findUnique({ where: { normalizedName } })
          : row.data.type === 'PROGRAM'
            ? await db.program.findUnique({ where: { normalizedName } })
            : await db.product.findUnique({ where: { normalizedName } });
    if (
      row.sheet === 'Вузы' &&
      existing &&
      !(await db.university.count({
        where: { AND: [{ id: existing.id }, universityScope(user)] },
      }))
    ) {
      return {
        ...row,
        action: 'ERROR',
        errors: [
          { column: 'Название вуза', code: 'SCOPE', message: 'Вуз недоступен' },
        ],
      };
    }
    return {
      ...row,
      action: existing
        ? existing.name === name
          ? 'SKIP'
          : 'UPDATE'
        : 'CREATE',
    };
  }
  async savePreview(
    id: string,
    executionId: string,
    rows: ParsedRow[],
    counts: Prisma.InputJsonObject,
    resultKey: string,
  ) {
    return this.database.prisma.$transaction(
      async (tx) => {
        const owns = await tx.importJob.updateMany({
          where: {
            id,
            executionId,
            status: 'RUNNING',
            leaseUntil: { gt: new Date() },
            expiresAt: { gt: new Date() },
          },
          data: {
            status: 'PREVIEW',
            counts,
            resultKey,
            progress: 100,
            leaseUntil: null,
          },
        });
        if (!owns.count) return false;
        await tx.importRow.deleteMany({ where: { jobId: id } });
        for (let offset = 0; offset < rows.length; offset += 1000) {
          await tx.importRow.createMany({
            data: rows.slice(offset, offset + 1000).map((row, index) => ({
              jobId: id,
              position: offset + index,
              ...row,
              errors: row.errors.map((e) => ({ ...e })),
            })),
          });
        }
        return true;
      },
      { timeout: 60000 },
    );
  }
  async applyCatalog(
    tx: Prisma.TransactionClient,
    row: ParsedRow,
    user: AuthUser,
  ): Promise<string> {
    const name = String(row.data.name),
      normalizedName = catalogKey(name);
    // Serialize imports of the same natural key; the unique DB key also protects manual writers.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.sheet + '/' + row.key}, 0))::text`;
    if (row.sheet === 'Вузы') {
      const item = await tx.university.findUnique({
        where: { normalizedName },
      });
      if (item) {
        if (
          !(await tx.university.count({
            where: { AND: [{ id: item.id }, universityScope(user)] },
          }))
        )
          throw new ForbiddenException('University outside scope');
        if (item.name === name) return 'SKIPPED';
        await tx.university.update({ where: { id: item.id }, data: { name } });
        return 'UPDATED';
      }
      await tx.university.create({
        data: {
          name,
          createdById: user.id,
          assignments: { create: { userId: user.id } },
        },
      });
      return 'CREATED';
    }
    const kind =
      row.sheet === 'Направления'
        ? 'direction'
        : row.data.type === 'PROGRAM'
          ? 'program'
          : 'product';
    const item =
      kind === 'direction'
        ? await tx.direction.findUnique({ where: { normalizedName } })
        : kind === 'program'
          ? await tx.program.findUnique({ where: { normalizedName } })
          : await tx.product.findUnique({ where: { normalizedName } });
    if (item?.name === name) return 'SKIPPED';
    if (item) {
      const args = { where: { id: item.id }, data: { name } };
      if (kind === 'direction') await tx.direction.update(args);
      else if (kind === 'program') await tx.program.update(args);
      else await tx.product.update(args);
      return 'UPDATED';
    }
    if (kind === 'direction') await tx.direction.create({ data: { name } });
    else if (kind === 'program') await tx.program.create({ data: { name } });
    else await tx.product.create({ data: { name } });
    return 'CREATED';
  }
  async applyRow(
    jobId: string,
    executionId: string,
    rowId: string,
    row: ParsedRow,
    user: AuthUser,
    person?: Employee,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      // Lock the row and lease together: a duplicate delivery cannot apply a mutation twice.
      await tx.$queryRaw`SELECT id FROM import_jobs WHERE id = ${jobId}::uuid FOR UPDATE`;
      const owner = await tx.importJob.findFirst({
        where: {
          id: jobId,
          executionId,
          status: 'RUNNING',
          expiresAt: { gt: new Date() },
          leaseUntil: { gt: new Date() },
        },
      });
      if (!owner) throw new ConflictException('Import lease lost');
      await tx.$queryRaw`SELECT id FROM import_rows WHERE id = ${rowId}::uuid FOR UPDATE`;
      const current = await tx.importRow.findUniqueOrThrow({
        where: { id: rowId },
      });
      if (current.jobId !== jobId)
        throw new ConflictException('Import row mismatch');
      if (current.processedAt) return;
      let result = 'SKIPPED';
      if (row.errors.length) result = 'ERROR';
      else if (!row.data.duplicateOf) {
        if (person) {
          const existing = await tx.user.findUnique({
            where: { keycloakSubject: person.subject },
          });
          await tx.user.upsert({
            where: { keycloakSubject: person.subject },
            create: {
              keycloakSubject: person.subject,
              email: person.email,
              displayName: person.name,
              displayNameOverride: String(row.data.fullName),
            },
            update: { displayNameOverride: String(row.data.fullName) },
          });
          result = !existing
            ? 'CREATED'
            : existing.displayNameOverride === row.data.fullName
              ? 'SKIPPED'
              : 'UPDATED';
        } else result = await this.applyCatalog(tx, row, user);
      }
      if (
        !(await tx.importJob.count({
          where: {
            id: jobId,
            executionId,
            status: 'RUNNING',
            leaseUntil: { gt: new Date() },
          },
        }))
      )
        throw new ConflictException('Import lease lost');
      await tx.importRow.update({
        where: { id: rowId },
        data: { result, processedAt: new Date() },
      });
    });
  }
  active(id: string, executionId: string, phase: string) {
    return this.database.prisma.importJob.findFirst({
      where: {
        id,
        executionId,
        phase,
        status: 'RUNNING',
        leaseUntil: { gt: new Date() },
      },
    });
  }
  localEmployee(keycloakSubject: string) {
    return this.database.prisma.user.findUnique({
      where: { keycloakSubject },
      select: { displayNameOverride: true },
    });
  }
  progress(id: string, executionId: string, progress: number) {
    return this.database.prisma.importJob.updateMany({
      where: {
        id,
        executionId,
        status: 'RUNNING',
        leaseUntil: { gt: new Date() },
      },
      data: { progress },
    });
  }
  rows(jobId: string, pending = false) {
    return this.database.prisma.importRow.findMany({
      where: { jobId, ...(pending ? { processedAt: null } : {}) },
      orderBy: { position: 'asc' },
    });
  }
  rowCount(jobId: string) {
    return this.database.prisma.importRow.count({ where: { jobId } });
  }
  async page(jobId: string, page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      this.database.prisma.importRow.findMany({
        where: { jobId },
        orderBy: { position: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sheet: true,
          rowNumber: true,
          key: true,
          data: true,
          action: true,
          result: true,
          errors: true,
          processedAt: true,
        },
      }),
      this.rowCount(jobId),
    ]);
    return { rows, total };
  }
  beginApply(id: string, ownerId: string) {
    return this.database.prisma.importJob.updateMany({
      where: { id, ownerId, status: 'PREVIEW', expiresAt: { gt: new Date() } },
      data: {
        phase: 'APPLY',
        status: 'QUEUED',
        attempts: 0,
        executionId: null,
        leaseUntil: null,
        progress: 0,
        errorCode: null,
      },
    });
  }
  complete(
    id: string,
    executionId: string,
    counts: Prisma.InputJsonObject,
    resultKey: string,
  ) {
    return this.database.prisma.importJob.updateMany({
      where: {
        id,
        executionId,
        status: 'RUNNING',
        leaseUntil: { gt: new Date() },
        expiresAt: { gt: new Date() },
      },
      data: {
        status: 'SUCCEEDED',
        progress: 100,
        completedAt: new Date(),
        leaseUntil: null,
        counts,
        resultKey,
      },
    });
  }
  async rowError(
    jobId: string,
    executionId: string,
    id: string,
    errors: RowError[],
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      // Error rows consume work too, so fence them exactly like successful mutations.
      await tx.$queryRaw`SELECT id FROM import_jobs WHERE id = ${jobId}::uuid FOR UPDATE`;
      const owns = await tx.importJob.count({
        where: {
          id: jobId,
          executionId,
          status: 'RUNNING',
          leaseUntil: { gt: new Date() },
          expiresAt: { gt: new Date() },
        },
      });
      if (!owns) throw new ConflictException('Import lease lost');
      return tx.importRow.updateMany({
        where: { id, jobId, processedAt: null },
        data: {
          result: 'ERROR',
          errors: errors.map((e) => ({ ...e })),
          processedAt: new Date(),
        },
      });
    });
  }
}
