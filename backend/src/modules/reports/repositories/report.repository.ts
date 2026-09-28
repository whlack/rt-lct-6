import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { publicProfile, type AuthUser } from '../../auth/index.js';
import { projectScope } from '../../projects/index.js';
import { reportWhere } from '../report-filters.js';
import type {
  ReportFiltersDto,
  ReportQueryDto,
} from '../dto/report-query.dto.js';

export const personSelect = {
  id: true,
  keycloakSubject: true,
  displayName: true,
  displayNameOverride: true,
  email: true,
} as const;
export const reportInclude = {
  university: { select: { id: true, name: true } },
  direction: { select: { id: true, name: true } },
  program: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  responsible: { select: personSelect },
  supervisor: { select: personSelect },
  stages: {
    orderBy: { position: 'asc' as const },
    select: { id: true, title: true, position: true },
  },
};
export type ReportProject = Prisma.ProjectGetPayload<{
  include: typeof reportInclude;
}>;
export function summaryRow(project: ReportProject) {
  return {
    id: project.id,
    university: project.university,
    direction: project.direction,
    offering: {
      type: project.program ? 'PROGRAM' : 'PRODUCT',
      ...(project.program ?? project.product),
    },
    status: project.closedAt ? 'CLOSED' : 'ACTIVE',
    currentStage:
      project.stages.find(
        (stage) => stage.position === project.currentStageIndex,
      ) ?? null,
    responsible: publicProfile(project.responsible),
    supervisor: project.supervisor ? publicProfile(project.supervisor) : null,
    createdAt: project.createdAt,
    closedAt: project.closedAt,
    vendor: project.vendor,
    contractNumber: project.contractNumber,
    licenseSignedAt: project.licenseSignedAt,
    licenseExpiresYear: project.licenseExpiresYear,
    transferStatus: project.transferStatus,
  };
}
@Injectable()
export class ReportRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  snapshot<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.database.prisma.$transaction(operation, {
      isolationLevel: 'RepeatableRead',
      timeout: 60000,
    });
  }
  async list(user: AuthUser, query: ReportQueryDto) {
    return this.snapshot(async (tx) => {
      const where = await reportWhere(tx, user, query);
      const total = await tx.project.count({ where });
      const projects = await tx.project.findMany({
        where,
        include: reportInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        rows: projects.map(summaryRow),
        total,
        page: query.page,
        pageSize: query.pageSize,
        filters: query,
        generatedAt: new Date(),
        timezone: process.env.REPORT_TIMEZONE ?? 'Europe/Moscow',
      };
    });
  }
  async all(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    filters: ReportFiltersDto,
  ) {
    return tx.project.findMany({
      where: await reportWhere(tx, user, filters),
      include: reportInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  async detail(tx: Prisma.TransactionClient, user: AuthUser, id: string) {
    const project = await tx.project.findFirst({
      where: { AND: [{ id }, projectScope(user)] },
      include: {
        ...reportInclude,
        stages: {
          orderBy: { position: 'asc' },
          include: {
            expectedContact: { select: { id: true, name: true } },
            documentTypes: true,
            files: {
              select: {
                id: true,
                documentTypeId: true,
                fileName: true,
                mimeType: true,
                size: true,
                status: true,
                createdAt: true,
                uploadedBy: { select: personSelect },
              },
            },
          },
        },
        comments: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            parentId: true,
            body: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            author: { select: personSelect },
          },
        },
        events: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { actor: { select: personSelect } },
        },
      },
    });
    if (!project) return null;
    return {
      ...summaryRow(project),
      stages: project.stages.map((stage) => ({
        ...stage,
        files: stage.files.map((file) => ({
          ...file,
          uploadedBy: publicProfile(file.uploadedBy),
        })),
      })),
      comments: project.comments.map((c) => ({
        ...c,
        author: publicProfile(c.author),
        body: c.deletedAt ? null : c.body,
      })),
      events: project.events.map((event) => ({
        ...event,
        actor: publicProfile(event.actor),
      })),
      generatedAt: new Date(),
    };
  }
}
