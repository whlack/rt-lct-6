import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../database/database.service.js';
import { publicProfile, type AuthUser } from '../../auth/index.js';
import { projectScope } from '../project-scope.js';
import type { ProjectQueryDto } from '../dto/project.dto.js';

const profileSelect = {
  id: true,
  keycloakSubject: true,
  displayName: true,
  displayNameOverride: true,
  email: true,
} as const;
const projectInclude = {
  university: { select: { id: true, name: true } },
  direction: { select: { id: true, name: true } },
  program: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  responsible: { select: { id: true, keycloakSubject: true } },
  supervisor: { select: { id: true, keycloakSubject: true } },
  stages: {
    orderBy: { position: 'asc' as const },
    include: {
      expectedContact: { select: { id: true, name: true } },
      documentTypes: { orderBy: { name: 'asc' as const } },
      files: {
        select: {
          id: true,
          documentTypeId: true,
          fileName: true,
          mimeType: true,
          size: true,
          status: true,
          uploadedById: true,
          createdAt: true,
        },
      },
    },
  },
};

export type ProjectView = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

export interface ProjectEventInput {
  actorId: string;
  type: string;
  objectType: string;
  objectId: string;
  details?: Prisma.InputJsonValue;
}

export class LockedProject {
  constructor(
    readonly project: ProjectView,
    private readonly tx: Prisma.TransactionClient,
  ) {}

  async hasScope(user: AuthUser): Promise<boolean> {
    return (
      (await this.tx.project.count({
        where: { AND: [{ id: this.project.id }, projectScope(user)] },
      })) > 0
    );
  }

  update(data: Prisma.ProjectUpdateInput) {
    return this.tx.project.update({ where: { id: this.project.id }, data });
  }

  async replaceUpcomingStages(
    stages: Array<{
      title: string;
      expectedActor: 'KAM' | 'UNIVERSITY';
      expectedContactId?: string;
      documentTypes: Array<{ name: string; isRequired: boolean }>;
    }>,
  ) {
    await this.tx.projectStage.deleteMany({
      where: { projectId: this.project.id, position: { gt: 0 } },
    });
    for (const [index, stage] of stages.entries()) {
      await this.tx.projectStage.create({
        data: {
          projectId: this.project.id,
          position: index + 1,
          title: stage.title,
          expectedActor: stage.expectedActor,
          expectedContactId: stage.expectedContactId,
          documentTypes: { create: stage.documentTypes },
        },
      });
    }
  }

  async missingRequired(stageId: string): Promise<string[]> {
    const types = await this.tx.stageDocumentType.findMany({
      where: { stageId, isRequired: true },
      include: { files: { select: { id: true }, take: 1 } },
    });
    return types
      .filter((type) => type.files.length === 0)
      .map((type) => type.name);
  }

  event(input: ProjectEventInput) {
    return this.tx.projectEvent.create({
      data: { projectId: this.project.id, ...input },
    });
  }

  createFile(data: Prisma.ProjectFileUncheckedCreateInput) {
    return this.tx.projectFile.create({ data });
  }

  completeFile(id: string) {
    return this.tx.projectFile.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }
}

@Injectable()
export class ProjectRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  list(user: AuthUser, query: ProjectQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ProjectWhereInput = {
      AND: [
        projectScope(user),
        {
          universityId: query.universityId,
          directionId: query.directionId,
          programId: query.programId,
          productId: query.productId,
          ...(query.responsibleSubject
            ? { responsible: { keycloakSubject: query.responsibleSubject } }
            : {}),
          ...(query.status
            ? { closedAt: query.status === 'ACTIVE' ? null : { not: null } }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    university: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                  {
                    direction: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                  {
                    program: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                  {
                    product: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                  { contractNumber: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      ],
    };
    return this.database.prisma.$transaction(
      async (tx) => {
        // Current position is a column comparison, not a relation filter on any KAM stage.
        if (query.actionRequired) {
          const ids = await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT p.id FROM projects p
            JOIN project_stages s ON s.project_id = p.id AND s.position = p.current_stage_index
            WHERE p.closed_at IS NULL AND s.expected_actor = 'KAM'`;
          where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : []),
            { id: { in: ids.map((item) => item.id) } },
          ];
        }
        const total = await tx.project.count({ where });
        const projects = await tx.project.findMany({
          where,
          select: {
            id: true,
            university: { select: { id: true, name: true } },
            direction: { select: { id: true, name: true } },
            program: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
            responsibleId: true,
            responsible: { select: profileSelect },
            supervisorId: true,
            supervisor: { select: profileSelect },
            currentStageIndex: true,
            closedAt: true,
            createdAt: true,
            stages: {
              select: {
                id: true,
                position: true,
                title: true,
                expectedActor: true,
                expectedContact: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        const rows = projects.map(
          ({ stages, responsible, supervisor, ...project }) => ({
            ...project,
            responsible: publicProfile(responsible),
            supervisor: supervisor ? publicProfile(supervisor) : null,
            stageCount: stages.length,
            currentStage:
              stages.find(
                (stage) => stage.position === project.currentStageIndex,
              ) ?? null,
          }),
        );
        return { rows, total, page: query.page, pageSize: query.pageSize };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async activity(user: AuthUser) {
    const events = await this.database.prisma.projectEvent.findMany({
      where: { project: projectScope(user) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
      select: {
        id: true,
        type: true,
        createdAt: true,
        details: true,
        actor: { select: profileSelect },
        project: {
          select: {
            id: true,
            university: { select: { id: true, name: true } },
            program: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
        },
      },
    });
    return events.map(({ actor, ...event }) => ({
      ...event,
      actor: publicProfile(actor),
    }));
  }

  find(id: string): Promise<ProjectView | null> {
    return this.database.prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
  }

  findVisible(user: AuthUser, id: string): Promise<ProjectView | null> {
    return this.database.prisma.project.findFirst({
      where: { AND: [{ id }, projectScope(user)] },
      include: projectInclude,
    });
  }

  async create(
    data: Prisma.ProjectUncheckedCreateInput,
    titles: readonly string[],
    actorId: string,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...data,
          stages: {
            create: titles.map((title, position) => ({ title, position })),
          },
        },
      });
      await tx.projectEvent.create({
        data: {
          projectId: project.id,
          actorId,
          type: 'PROJECT_CREATED',
          objectType: 'project',
          objectId: project.id,
        },
      });
      return project;
    });
  }

  async withLock<T>(
    id: string,
    operation: (locked: LockedProject | null) => Promise<T>,
  ): Promise<T> {
    return this.database.prisma.$transaction(async (tx) => {
      // Row lock serializes workflow edits, transitions, and closing of one project.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${id}::uuid FOR UPDATE`;
      const project = await tx.project.findUnique({
        where: { id },
        include: projectInclude,
      });
      return operation(project ? new LockedProject(project, tx) : null);
    });
  }

  findContact(id: string) {
    return this.database.prisma.universityContact.findUnique({ where: { id } });
  }

  listEvents(projectId: string) {
    return this.database.prisma.projectEvent
      .findMany({
        where: { projectId },
        include: {
          actor: {
            select: {
              displayName: true,
              displayNameOverride: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      .then((events) =>
        events.map((event) => ({
          ...event,
          actor: publicProfile(event.actor),
        })),
      );
  }

  findFile(id: string) {
    return this.database.prisma.projectFile.findUnique({ where: { id } });
  }

  listComments(projectId: string) {
    return this.database.prisma.projectComment
      .findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          parentId: true,
          authorId: true,
          author: {
            select: {
              displayName: true,
              displayNameOverride: true,
              email: true,
            },
          },
          body: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .then((comments) =>
        comments.map((comment) => ({
          ...comment,
          author: publicProfile(comment.author),
          body: comment.deletedAt ? null : comment.body,
        })),
      );
  }

  findComment(id: string) {
    return this.database.prisma.projectComment.findUnique({ where: { id } });
  }

  async createComment(
    projectId: string,
    parentId: string | undefined,
    authorId: string,
    body: string,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      const comment = await tx.projectComment.create({
        data: { projectId, parentId, authorId, body },
      });
      await tx.projectEvent.create({
        data: {
          projectId,
          actorId: authorId,
          type: 'COMMENT_CREATED',
          objectType: 'comment',
          objectId: comment.id,
          details: { parentId: parentId ?? null },
        },
      });
      return comment;
    });
  }

  private async mutateComment(
    projectId: string,
    id: string,
    user: AuthUser,
    body: string | null,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      // Check deletion and authorship under the same row lock as the write.
      await tx.$queryRaw`SELECT id FROM project_comments WHERE id = ${id}::uuid FOR UPDATE`;
      const comment = await tx.projectComment.findUnique({ where: { id } });
      if (!comment || comment.projectId !== projectId)
        throw new NotFoundException('Comment not found');
      if (
        !(await tx.project.count({
          where: { AND: [{ id: projectId }, projectScope(user)] },
        }))
      )
        throw new NotFoundException('Project not found');
      if (comment.deletedAt) throw new ConflictException('Comment was deleted');
      if (user.level < 20 && comment.authorId !== user.id)
        throw new ForbiddenException('Comment belongs to another author');
      const updated = await tx.projectComment.update({
        where: { id },
        data: body === null ? { body: '', deletedAt: new Date() } : { body },
      });
      await tx.projectEvent.create({
        data: {
          projectId,
          actorId: user.id,
          type: body === null ? 'COMMENT_DELETED' : 'COMMENT_UPDATED',
          objectType: 'comment',
          objectId: id,
        },
      });
      return { ...updated, body: updated.deletedAt ? null : updated.body };
    });
  }

  updateComment(projectId: string, id: string, user: AuthUser, body: string) {
    return this.mutateComment(projectId, id, user, body);
  }

  deleteComment(projectId: string, id: string, user: AuthUser) {
    return this.mutateComment(projectId, id, user, null);
  }
}
