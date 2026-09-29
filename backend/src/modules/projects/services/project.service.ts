import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PageDto } from '../../../common/page.dto.js';
import type { AuthUser } from '../../auth/index.js';
import { AuthService } from '../../auth/index.js';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { UniversityService } from '../../universities/index.js';
import type {
  AdvanceStageDto,
  CommentDto,
  ConfigureWorkflowDto,
  CreateProjectDto,
  UpdateProjectDto,
} from '../dto/project.dto.js';
import {
  LockedProject,
  ProjectRepository,
  type ProjectView,
} from '../repositories/project.repository.js';

export const DEFAULT_STAGES = [
  'Формирование проекта',
  'Поиск контакта и согласование',
  'Документы и подписание',
  'Передача материалов и лицензий',
  'Внедрение программы или продукта',
  'Обучение преподавателей',
  'Проведение занятий',
  'Сопровождение и контроль',
] as const;

function handleReferenceError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2003'
  ) {
    throw new BadRequestException(
      'Referenced catalog or university does not exist',
    );
  }
  throw error;
}

@Injectable()
export class ProjectService {
  constructor(
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
    @Inject(UniversityService) private readonly universities: UniversityService,
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  list(user: AuthUser, query: PageDto) {
    return this.repository.list(user, query);
  }

  async getVisible(user: AuthUser, id: string): Promise<ProjectView> {
    const project = await this.repository.findVisible(user, id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(user: AuthUser, body: CreateProjectDto) {
    if (!!body.programId === !!body.productId)
      throw new BadRequestException('Select exactly one program or product');
    await this.universities.get(user, body.universityId);
    if (!(await this.directory.isKam(body.responsibleSubject)))
      throw new BadRequestException('Existing KAM required');
    const responsibleId = await this.auth.ensureUser(body.responsibleSubject);
    try {
      return await this.repository.create(
        {
          universityId: body.universityId,
          directionId: body.directionId,
          programId: body.programId,
          productId: body.productId,
          responsibleId,
          createdById: user.id,
          vendor: body.vendor === null ? null : body.vendor?.trim(),
          contractNumber:
            body.contractNumber === null ? null : body.contractNumber?.trim(),
          licenseSignedAt: body.licenseSignedAt
            ? new Date(body.licenseSignedAt)
            : undefined,
          licenseExpiresYear: body.licenseExpiresYear,
          transferStatus: body.transferStatus,
        },
        DEFAULT_STAGES,
        user.id,
      );
    } catch (error) {
      handleReferenceError(error);
    }
  }

  private assertOpen(project: ProjectView): void {
    if (project.closedAt) throw new ConflictException('Project is closed');
  }

  private async requireLocked(
    locked: LockedProject | null,
    user: AuthUser,
  ): Promise<LockedProject> {
    if (!locked) throw new NotFoundException('Project not found');
    if (!(await locked.hasScope(user)))
      throw new ForbiddenException('Project is outside your scope');
    this.assertOpen(locked.project);
    return locked;
  }

  async update(user: AuthUser, id: string, body: UpdateProjectDto) {
    await this.getVisible(user, id);
    return this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      const data = {
        vendor: body.vendor === null ? null : body.vendor?.trim(),
        contractNumber:
          body.contractNumber === null ? null : body.contractNumber?.trim(),
        licenseSignedAt:
          body.licenseSignedAt === null
            ? null
            : body.licenseSignedAt
              ? new Date(body.licenseSignedAt)
              : undefined,
        licenseExpiresYear: body.licenseExpiresYear,
        transferStatus: body.transferStatus,
      };
      const updated = await locked.update(data);
      await locked.event({
        actorId: user.id,
        type: 'PROJECT_UPDATED',
        objectType: 'project',
        objectId: id,
        details: { fields: Object.keys(body) },
      });
      if (
        body.licenseSignedAt &&
        new Date(body.licenseSignedAt).toISOString().slice(0, 10) !==
          locked.project.licenseSignedAt?.toISOString().slice(0, 10)
      ) {
        await locked.event({
          actorId: user.id,
          type: 'LICENSE_SIGNED',
          objectType: 'project',
          objectId: id,
          details: { date: body.licenseSignedAt },
        });
      }
      return updated;
    });
  }

  async assignResponsible(user: AuthUser, id: string, subject: string) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.getVisible(user, id);
    if (!(await this.directory.isKam(subject)))
      throw new BadRequestException('Existing KAM required');
    const responsibleId = await this.auth.ensureUser(subject);
    return this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      const previous = locked.project.responsibleId;
      const updated = await locked.update({
        responsible: { connect: { id: responsibleId } },
      });
      await locked.event({
        actorId: user.id,
        type: 'RESPONSIBLE_CHANGED',
        objectType: 'project',
        objectId: id,
        details: { previous, current: responsibleId },
      });
      return updated;
    });
  }

  async assignSupervisor(user: AuthUser, id: string, subject: string) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.getVisible(user, id);
    if (!(await this.directory.isManager(subject)))
      throw new BadRequestException(
        'Existing supervisor or administrator required',
      );
    const supervisorId = await this.auth.ensureUser(subject);
    return this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      const previous = locked.project.supervisorId;
      const updated = await locked.update({
        supervisor: { connect: { id: supervisorId } },
      });
      await locked.event({
        actorId: user.id,
        type: 'SUPERVISOR_CHANGED',
        objectType: 'project',
        objectId: id,
        details: { previous, current: supervisorId },
      });
      return updated;
    });
  }

  async configureWorkflow(
    user: AuthUser,
    id: string,
    body: ConfigureWorkflowDto,
  ) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.getVisible(user, id);
    const titles = body.stages.map((stage) => stage.title.trim());
    if (titles.some((title) => !title))
      throw new BadRequestException('Stage title is required');
    if (
      new Set(titles).size !== titles.length ||
      titles.includes(DEFAULT_STAGES[0])
    )
      throw new BadRequestException('Stage titles must be unique');
    for (const stage of body.stages) {
      if (stage.expectedActor === 'UNIVERSITY') {
        const contact =
          stage.expectedContactId &&
          (await this.repository.findContact(stage.expectedContactId));
        if (
          !contact ||
          contact.universityId !==
            (await this.getVisible(user, id)).universityId
        )
          throw new BadRequestException('Expected university contact required');
      } else if (stage.expectedContactId)
        throw new BadRequestException(
          'KAM stage cannot expect a university contact',
        );
      const documentNames = stage.documentTypes.map((item) => item.name.trim());
      if (
        documentNames.some((name) => !name) ||
        new Set(documentNames).size !== documentNames.length
      )
        throw new BadRequestException(
          'Document names must be non-empty and unique',
        );
    }
    await this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      if (
        locked.project.workflowLocked ||
        locked.project.currentStageIndex !== 0
      )
        throw new ConflictException('Workflow is locked');
      if (
        locked.project.stages.slice(1).some((stage) => stage.files.length > 0)
      )
        throw new ConflictException('Stage with files cannot be replaced');
      await locked.replaceUpcomingStages(
        body.stages.map((stage) => ({
          title: stage.title.trim(),
          expectedActor: stage.expectedActor,
          expectedContactId: stage.expectedContactId,
          documentTypes: stage.documentTypes.map((type) => ({
            name: type.name.trim(),
            isRequired: type.isRequired,
          })),
        })),
      );
      await locked.event({
        actorId: user.id,
        type: 'WORKFLOW_CONFIGURED',
        objectType: 'project',
        objectId: id,
        details: { stages: titles },
      });
    });
    return this.repository.find(id);
  }

  async advance(user: AuthUser, id: string, body: AdvanceStageDto) {
    // Scope and state are checked under the row lock; a preliminary card read duplicates the whole stage graph.
    return this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      const current = locked.project.stages[locked.project.currentStageIndex];
      if (!current || current.id !== body.expectedStageId)
        throw new ConflictException('Stage changed; reload project');
      const next = locked.project.stages[locked.project.currentStageIndex + 1];
      if (!next)
        throw new ConflictException('Last stage reached; close the project');
      const missing = await locked.missingRequired(current.id);
      if (missing.length)
        throw new ConflictException(
          `Required documents missing: ${missing.join(', ')}`,
        );
      const updated = await locked.update({
        currentStageIndex: { increment: 1 },
        workflowLocked: true,
      });
      await locked.event({
        actorId: user.id,
        type: 'STAGE_ADVANCED',
        objectType: 'stage',
        objectId: next.id,
        details: { from: current.id, to: next.id },
      });
      return updated;
    });
  }

  async close(user: AuthUser, id: string) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.getVisible(user, id);
    return this.repository.withLock(id, async (value) => {
      const locked = await this.requireLocked(value, user);
      if (locked.project.currentStageIndex !== locked.project.stages.length - 1)
        throw new ConflictException('Final stage not reached');
      const finalStage =
        locked.project.stages[locked.project.currentStageIndex];
      const missing = await locked.missingRequired(finalStage.id);
      if (missing.length)
        throw new ConflictException(
          `Required documents missing: ${missing.join(', ')}`,
        );
      const updated = await locked.update({ closedAt: new Date() });
      await locked.event({
        actorId: user.id,
        type: 'PROJECT_CLOSED',
        objectType: 'project',
        objectId: id,
      });
      return updated;
    });
  }

  async history(user: AuthUser, id: string) {
    await this.getVisible(user, id);
    return this.repository.listEvents(id);
  }

  async comments(user: AuthUser, id: string) {
    await this.getVisible(user, id);
    return this.repository.listComments(id);
  }

  async addComment(user: AuthUser, id: string, body: CommentDto) {
    await this.getVisible(user, id);
    if (!body.body.trim())
      throw new BadRequestException('Comment body is required');
    if (body.parentId) {
      const parent = await this.repository.findComment(body.parentId);
      if (!parent || parent.projectId !== id || parent.deletedAt)
        throw new BadRequestException('Parent comment is unavailable');
    }
    return this.repository.createComment(
      id,
      body.parentId,
      user.id,
      body.body.trim(),
    );
  }

  private async editableComment(
    user: AuthUser,
    projectId: string,
    commentId: string,
  ) {
    await this.getVisible(user, projectId);
    const comment = await this.repository.findComment(commentId);
    if (!comment || comment.projectId !== projectId)
      throw new NotFoundException('Comment not found');
    if (comment.deletedAt) throw new ConflictException('Comment was deleted');
    if (user.level < 20 && comment.authorId !== user.id)
      throw new ForbiddenException('Comment belongs to another author');
    return comment;
  }

  async editComment(
    user: AuthUser,
    projectId: string,
    commentId: string,
    body: string,
  ) {
    await this.editableComment(user, projectId, commentId);
    if (!body.trim()) throw new BadRequestException('Comment body is required');
    return this.repository.updateComment(
      projectId,
      commentId,
      user,
      body.trim(),
    );
  }

  async deleteComment(user: AuthUser, projectId: string, commentId: string) {
    await this.editableComment(user, projectId, commentId);
    return this.repository.deleteComment(projectId, commentId, user);
  }
}
