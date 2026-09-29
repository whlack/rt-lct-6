import {
  universityCard,
  universityContacts,
  universityContact,
  universityList,
  universityRecord,
  universityAssignments,
} from '../dto/university-response.schema.js';
import { UuidParam, ValidatedBody } from '../../../common/validated-input.js';
import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import {
  AssigneeDto,
  ContactDto,
  PrimaryContactDto,
  UniversityDto,
} from '../dto/university.dto.js';
import { UniversityService } from '../services/university.service.js';

@ApiTags('universities')
@ApiBearerAuth()
@Controller('api/universities')
export class UniversitiesController {
  constructor(
    @Inject(UniversityService) private readonly universities: UniversityService,
  ) {}

  @Get()
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityList })
  list(@Req() request: AuthRequest) {
    return this.universities.list(currentUser(request));
  }

  @Get(':id')
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityCard })
  get(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.get(currentUser(request), id);
  }

  @Post()
  @RequirePermission('universities.create')
  @ApiCreatedResponse({ schema: universityRecord })
  create(
    @Req() request: AuthRequest,
    @ValidatedBody(UniversityDto) body: UniversityDto,
  ) {
    return this.universities.create(currentUser(request), body.name);
  }

  @Patch(':id')
  @RequirePermission('universities.update')
  @ApiOkResponse({ schema: universityRecord })
  update(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(UniversityDto) body: UniversityDto,
  ) {
    return this.universities.update(currentUser(request), id, body.name);
  }

  @Get(':id/contacts')
  @RequirePermission('university_contacts.read')
  @ApiOkResponse({ schema: universityContacts })
  listContacts(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.listContacts(currentUser(request), id);
  }

  @Post(':id/contacts')
  @RequirePermission('university_contacts.create')
  @ApiCreatedResponse({ schema: universityContact })
  createContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(ContactDto) body: ContactDto,
  ) {
    return this.universities.createContact(currentUser(request), id, body);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission('university_contacts.update')
  @ApiOkResponse({ schema: universityContact })
  updateContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('contactId') contactId: string,
    @ValidatedBody(ContactDto) body: ContactDto,
  ) {
    return this.universities.updateContact(
      currentUser(request),
      id,
      contactId,
      body,
    );
  }

  @Patch(':id/primary-contact')
  @RequirePermission('university_contacts.update')
  @ApiOkResponse({ schema: universityRecord })
  setPrimaryContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(PrimaryContactDto) body: PrimaryContactDto,
  ) {
    return this.universities.setPrimaryContact(
      currentUser(request),
      id,
      body.contactId,
    );
  }

  @Get(':id/assignees')
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityAssignments })
  listAssignments(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.listAssignments(currentUser(request), id);
  }

  @Post(':id/assignees')
  @RequirePermission('universities.assignees.manage')
  @ApiCreatedResponse({ schema: universityAssignments })
  assign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssigneeDto) body: AssigneeDto,
  ) {
    return this.universities.assign(currentUser(request), id, body.subject);
  }

  @Delete(':id/assignees/:subject')
  @RequirePermission('universities.assignees.manage')
  @ApiOkResponse({ schema: universityAssignments })
  unassign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('subject') subject: string,
  ) {
    return this.universities.unassign(currentUser(request), id, subject);
  }
}
