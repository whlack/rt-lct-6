import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { DatabaseService } from '../../../database/database.service.js';
import type { AuthUser } from '../../auth/index.js';
import { projectScope } from '../project-scope.js';

const projectInclude = {
  university: { select: { id: true, name: true } },
  direction: true,
  program: true,
  product: true,
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
    if (user.level >= 20 || this.project.responsibleId === user.id) return true;
    const assignment = await this.tx.universityAssignment.findUnique({
      where: {
        universityId_userId: {
          universityId: this.project.universityId,
          userId: user.id,
        },
      },
      select: { userId: true },
    });
    return assignment !== null;
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

  list(user: AuthUser) {
    return this.database.prisma.project.findMany({
      where: projectScope(user),
      include: projectInclude,
      orderBy: { createdAt: 'desc' },
    });
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
    return this.database.prisma.projectEvent.findMany({
      where: { projectId },
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findFile(id: string) {
    return this.database.prisma.projectFile.findUnique({ where: { id } });
  }

  listComments(projectId: string) {
    return this.database.prisma.projectComment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        parentId: true,
        authorId: true,
        author: { select: { displayName: true, email: true } },
        body: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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

  async updateComment(
    projectId: string,
    id: string,
    actorId: string,
    body: string,
  ) {
    return this.database.prisma.$transaction(async (tx) => {
      const comment = await tx.projectComment.update({
        where: { id },
        data: { body },
      });
      await tx.projectEvent.create({
        data: {
          projectId,
          actorId,
          type: 'COMMENT_UPDATED',
          objectType: 'comment',
          objectId: id,
        },
      });
      return comment;
    });
  }

  async deleteComment(projectId: string, id: string, actorId: string) {
    return this.database.prisma.$transaction(async (tx) => {
      const comment = await tx.projectComment.update({
        where: { id },
        data: { body: '', deletedAt: new Date() },
      });
      await tx.projectEvent.create({
        data: {
          projectId,
          actorId,
          type: 'COMMENT_DELETED',
          objectType: 'comment',
          objectId: id,
        },
      });
      return comment;
    });
  }
}
