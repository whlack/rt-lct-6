import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import {
  AdvanceStageDto,
  AssignProjectDto,
  CommentBodyDto,
  CommentDto,
  ConfigureWorkflowDto,
  CreateProjectDto,
  UpdateProjectDto,
} from '../dto/project.dto.js';
import { ProjectService } from '../services/project.service.js';
import { ProjectFileService } from '../services/project-file.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('api/projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectFileService) private readonly files: ProjectFileService,
  ) {}

  @Get()
  @RequirePermission('projects.read')
  list(@Req() request: AuthRequest) {
    return this.projects.list(currentUser(request));
  }

  @Get(':id')
  @RequirePermission('projects.read')
  get(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getVisible(currentUser(request), id);
  }

  @Post()
  @RequirePermission('projects.create')
  create(@Req() request: AuthRequest, @Body() body: CreateProjectDto) {
    return this.projects.create(currentUser(request), body);
  }

  @Patch(':id')
  @RequirePermission('projects.update')
  update(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projects.update(currentUser(request), id, body);
  }

  @Patch(':id/responsible')
  @RequirePermission('projects.assignees.manage')
  assign(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignProjectDto,
  ) {
    return this.projects.assignResponsible(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/supervisor')
  @RequirePermission('projects.assignees.manage')
  assignSupervisor(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignProjectDto,
  ) {
    return this.projects.assignSupervisor(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/workflow')
  @RequirePermission('projects.workflow.configure')
  configure(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfigureWorkflowDto,
  ) {
    return this.projects.configureWorkflow(currentUser(request), id, body);
  }

  @Post(':id/advance')
  @RequirePermission('projects.stage.advance')
  advance(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdvanceStageDto,
  ) {
    return this.projects.advance(currentUser(request), id, body);
  }

  @Post(':id/close')
  @RequirePermission('projects.close')
  close(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.close(currentUser(request), id);
  }

  @Get(':id/history')
  @RequirePermission('projects.read')
  history(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.history(currentUser(request), id);
  }

  @Get(':id/comments')
  @RequirePermission('projects.read')
  comments(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.comments(currentUser(request), id);
  }

  @Post(':id/comments')
  @RequirePermission('projects.comments.create')
  addComment(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommentDto,
  ) {
    return this.projects.addComment(currentUser(request), id, body);
  }

  @Patch(':id/comments/:commentId')
  @RequirePermission('projects.comments.update')
  editComment(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: CommentBodyDto,
  ) {
    return this.projects.editComment(
      currentUser(request),
      id,
      commentId,
      body.body,
    );
  }

  @Delete(':id/comments/:commentId')
  @RequirePermission('projects.comments.delete')
  deleteComment(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.projects.deleteComment(currentUser(request), id, commentId);
  }

  @Post(':id/stages/:stageId/document-types/:documentTypeId/files')
  @RequirePermission('projects.files.manage')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  uploadFile(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Param('documentTypeId', ParseUUIDPipe) documentTypeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.files.upload(
      currentUser(request),
      id,
      stageId,
      documentTypeId,
      file,
    );
  }

  @Get(':id/files/:fileId')
  @RequirePermission('projects.read')
  async downloadFile(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const { file, body } = await this.files.download(
      currentUser(request),
      id,
      fileId,
    );
    const safeName = file.fileName.replace(/[\r\n"\\]/g, '_');
    return new StreamableFile(Buffer.from(body), {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${safeName}"`,
      length: file.size,
    });
  }

  @Post(':id/files/:fileId/complete')
  @RequirePermission('projects.files.manage')
  completeFile(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.files.complete(currentUser(request), id, fileId);
  }
}
