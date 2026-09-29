import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { AuthUser } from '../../auth/index.js';
import { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectService } from './project.service.js';

const allowed = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.pdf',
  '.zip',
  '.gz',
  '.rar',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);
function fileView<T extends { storageKey: string }>(
  file: T,
): Omit<T, 'storageKey'> {
  const { storageKey, ...view } = file;
  if (!storageKey) throw new Error('File storage key is missing');
  return view;
}

@Injectable()
export class ProjectFileService {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
    @Inject(S3Adapter) private readonly storage: S3Adapter,
  ) {}

  async upload(
    user: AuthUser,
    projectId: string,
    stageId: string,
    documentTypeId: string,
    file: Express.Multer.File,
  ) {
    if (!file || !allowed.has(extname(file.originalname).toLowerCase()))
      throw new BadRequestException('Unsupported file format');
    if (!file.size || file.size > 25 * 1024 * 1024)
      throw new BadRequestException('File size must be 1–25 MB');
    const project = await this.projects.getVisible(user, projectId);
    if (project.closedAt) throw new ConflictException('Project is closed');
    const stage = project.stages.find((item) => item.id === stageId);
    if (
      !stage ||
      !stage.documentTypes.some((item) => item.id === documentTypeId)
    )
      throw new BadRequestException(
        'Document type does not belong to the stage',
      );
    if (stage.position !== project.currentStageIndex)
      throw new ConflictException(
        'Files can be attached only to the current stage',
      );
    const key = `projects/${projectId}/${randomUUID()}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    try {
      return await this.repository.withLock(projectId, async (locked) => {
        if (!locked) throw new NotFoundException('Project not found');
        if (!(await locked.hasScope(user)))
          throw new ForbiddenException('Project is outside your scope');
        if (
          locked.project.closedAt ||
          locked.project.stages[locked.project.currentStageIndex]?.id !==
            stageId
        )
          throw new ConflictException('Current stage changed');
        const current = locked.project.stages[locked.project.currentStageIndex];
        if (!current.documentTypes.some((item) => item.id === documentTypeId))
          throw new BadRequestException('Document type changed');
        const created = await locked.createFile({
          stageId,
          documentTypeId,
          storageKey: key,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedById: user.id,
        });
        await locked.event({
          actorId: user.id,
          type: 'FILE_ATTACHED',
          objectType: 'file',
          objectId: created.id,
          details: { fileName: file.originalname, stageId },
        });
        return fileView(created);
      });
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  async download(user: AuthUser, projectId: string, fileId: string) {
    const project = await this.projects.getVisible(user, projectId);
    const file = await this.repository.findFile(fileId);
    if (!file || !project.stages.some((stage) => stage.id === file.stageId))
      throw new NotFoundException('File not found');
    return { file, body: await this.storage.get(file.storageKey) };
  }

  async complete(user: AuthUser, projectId: string, fileId: string) {
    await this.projects.getVisible(user, projectId);
    return this.repository.withLock(projectId, async (locked) => {
      if (!locked) throw new NotFoundException('Project not found');
      if (!(await locked.hasScope(user)))
        throw new ForbiddenException('Project is outside your scope');
      if (locked.project.closedAt)
        throw new ConflictException('Project is closed');
      const stage = locked.project.stages[locked.project.currentStageIndex];
      const file = stage?.files.find((item) => item.id === fileId);
      if (!file) throw new NotFoundException('File not found on current stage');
      if (file.status === 'COMPLETED') return { ...file, stageId: stage.id };
      const updated = await locked.completeFile(fileId);
      await locked.event({
        actorId: user.id,
        type: 'FILE_COMPLETED',
        objectType: 'file',
        objectId: fileId,
      });
      return fileView(updated);
    });
  }
}
