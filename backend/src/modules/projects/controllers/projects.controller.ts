import { attachmentDisposition } from '../../../common/attachment-disposition.js';
import {
  projectActivity,
  projectCard,
  projectComment,
  projectComments,
  projectFile,
  projectHistory,
  projectPage,
  projectRecord,
} from '../dto/project-response.schema.js';
import { UploadLimitInterceptor } from '../../../common/upload-limit.interceptor.js';
import { ProjectQueryDto } from '../dto/project.dto.js';
import {
  UuidParam,
  ValidatedBody,
  ValidatedQuery,
} from '../../../common/validated-input.js';
import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
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
  @ApiOkResponse({ schema: projectPage })
  list(
    @Req() request: AuthRequest,
    @ValidatedQuery(ProjectQueryDto) query: ProjectQueryDto,
  ) {
    return this.projects.list(currentUser(request), query);
  }

  @Get('activity')
  @RequirePermission('projects.read')
  @ApiOperation({ summary: 'Последние события видимых проектов' })
  @ApiOkResponse({ schema: projectActivity })
  activity(@Req() request: AuthRequest) {
    return this.projects.activity(currentUser(request));
  }

  @Get(':id')
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectCard })
  get(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.getVisible(currentUser(request), id);
  }

  @Post()
  @RequirePermission('projects.create')
  @ApiCreatedResponse({ schema: projectRecord })
  create(
    @Req() request: AuthRequest,
    @ValidatedBody(CreateProjectDto) body: CreateProjectDto,
  ) {
    return this.projects.create(currentUser(request), body);
  }

  @Patch(':id')
  @RequirePermission('projects.update')
  @ApiOkResponse({ schema: projectRecord })
  update(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(UpdateProjectDto) body: UpdateProjectDto,
  ) {
    return this.projects.update(currentUser(request), id, body);
  }

  @Patch(':id/responsible')
  @RequirePermission('projects.assignees.manage')
  @ApiOkResponse({ schema: projectRecord })
  assign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssignProjectDto) body: AssignProjectDto,
  ) {
    return this.projects.assignResponsible(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/supervisor')
  @RequirePermission('projects.assignees.manage')
  @ApiOkResponse({ schema: projectRecord })
  assignSupervisor(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssignProjectDto) body: AssignProjectDto,
  ) {
    return this.projects.assignSupervisor(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/workflow')
  @RequirePermission('projects.workflow.configure')
  @ApiOkResponse({ schema: projectCard })
  configure(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(ConfigureWorkflowDto) body: ConfigureWorkflowDto,
  ) {
    return this.projects.configureWorkflow(currentUser(request), id, body);
  }

  @Post(':id/advance')
  @RequirePermission('projects.stage.advance')
  @ApiCreatedResponse({ schema: projectRecord })
  advance(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AdvanceStageDto) body: AdvanceStageDto,
  ) {
    return this.projects.advance(currentUser(request), id, body);
  }

  @Post(':id/close')
  @RequirePermission('projects.close')
  @ApiCreatedResponse({ schema: projectRecord })
  close(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.close(currentUser(request), id);
  }

  @Get(':id/history')
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectHistory })
  history(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.history(currentUser(request), id);
  }

  @Get(':id/comments')
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectComments })
  comments(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.comments(currentUser(request), id);
  }

  @Post(':id/comments')
  @RequirePermission('projects.comments.create')
  @ApiCreatedResponse({ schema: projectComment })
  addComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(CommentDto) body: CommentDto,
  ) {
    return this.projects.addComment(currentUser(request), id, body);
  }

  @Patch(':id/comments/:commentId')
  @RequirePermission('projects.comments.update')
  @ApiOkResponse({ schema: projectComment })
  editComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('commentId') commentId: string,
    @ValidatedBody(CommentBodyDto) body: CommentBodyDto,
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
  @ApiOkResponse({ schema: projectComment })
  deleteComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('commentId') commentId: string,
  ) {
    return this.projects.deleteComment(currentUser(request), id, commentId);
  }

  @Post(':id/stages/:stageId/document-types/:documentTypeId/files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @RequirePermission('projects.files.manage')
  @UseInterceptors(
    UploadLimitInterceptor,
    FileInterceptor('file', {
      limits: {
        files: 1,
        fields: 10,
        parts: 11,
        fieldSize: 4096,
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  @ApiCreatedResponse({ schema: projectFile })
  uploadFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('stageId') stageId: string,
    @UuidParam('documentTypeId') documentTypeId: string,
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
  @ApiOkResponse({
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async downloadFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('fileId') fileId: string,
  ) {
    const { file, body } = await this.files.download(
      currentUser(request),
      id,
      fileId,
    );
    return new StreamableFile(Buffer.from(body), {
      type: 'application/octet-stream',
      disposition: attachmentDisposition(file.fileName),
      length: file.size,
    });
  }

  @Post(':id/files/:fileId/complete')
  @RequirePermission('projects.files.manage')
  @ApiCreatedResponse({ schema: projectFile })
  completeFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('fileId') fileId: string,
  ) {
    return this.files.complete(currentUser(request), id, fileId);
  }
}
