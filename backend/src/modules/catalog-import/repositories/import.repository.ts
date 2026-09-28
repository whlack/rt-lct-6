import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { AuthUser } from '../../auth/index.js';
import { universityScope } from '../../universities/index.js';
import { catalogKey } from '../../../common/catalog-name.js';
import type { ParsedRow, RowError } from '../workbook.js';
import { artifactExpiry } from '../../../config/jobs.js';

@Injectable()
export class ImportRepository {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  create(
    ownerId: string,
    fileName: string,
    sourceKey: string,
    checksum: string,
  ) {
    return this.database.prisma.importJob.create({
      data: {
        ownerId,
        fileName,
        sourceKey,
        checksum,
        expiresAt: artifactExpiry(),
      },
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
          where: { id, executionId, status: 'RUNNING' },
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
  async rowError(id: string, errors: RowError[]) {
    await this.database.prisma.importRow.updateMany({
      where: { id, processedAt: null },
      data: {
        result: 'ERROR',
        errors: errors.map((e) => ({ ...e })),
        processedAt: new Date(),
      },
    });
  }
}
