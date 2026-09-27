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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  list(@Req() request: AuthRequest) {
    return this.universities.list(currentUser(request));
  }

  @Get(':id')
  @RequirePermission('universities.read')
  get(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.universities.get(currentUser(request), id);
  }

  @Post()
  @RequirePermission('universities.create')
  create(@Req() request: AuthRequest, @Body() body: UniversityDto) {
    return this.universities.create(currentUser(request), body.name);
  }

  @Patch(':id')
  @RequirePermission('universities.update')
  update(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UniversityDto,
  ) {
    return this.universities.update(currentUser(request), id, body.name);
  }

  @Get(':id/contacts')
  @RequirePermission('university_contacts.read')
  listContacts(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.universities.listContacts(currentUser(request), id);
  }

  @Post(':id/contacts')
  @RequirePermission('university_contacts.create')
  createContact(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ContactDto,
  ) {
    return this.universities.createContact(currentUser(request), id, body);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission('university_contacts.update')
  updateContact(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() body: ContactDto,
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
  setPrimaryContact(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PrimaryContactDto,
  ) {
    return this.universities.setPrimaryContact(
      currentUser(request),
      id,
      body.contactId,
    );
  }

  @Get(':id/assignees')
  @RequirePermission('universities.read')
  listAssignments(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.universities.listAssignments(currentUser(request), id);
  }

  @Post(':id/assignees')
  @RequirePermission('universities.assignees.manage')
  assign(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssigneeDto,
  ) {
    return this.universities.assign(currentUser(request), id, body.subject);
  }

  @Delete(':id/assignees/:subject')
  @RequirePermission('universities.assignees.manage')
  unassign(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subject', ParseUUIDPipe) subject: string,
  ) {
    return this.universities.unassign(currentUser(request), id, subject);
  }
}
