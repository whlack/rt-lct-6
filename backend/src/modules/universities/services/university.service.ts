import { catalogName } from '../../../common/catalog-name.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/index.js';
import { AuthService } from '../../auth/index.js';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { universityScope } from '../university-scope.js';
import { UniversityRepository } from '../repositories/university.repository.js';
import type { ContactDto } from '../dto/university.dto.js';

function rethrow(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('University name already exists');
  }
  throw error;
}

@Injectable()
export class UniversityService {
  constructor(
    @Inject(UniversityRepository)
    private readonly repository: UniversityRepository,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
  ) {}

  list(user: AuthUser) {
    return this.repository.list(user);
  }

  async get(user: AuthUser, id: string) {
    const university = await this.repository.find(id);
    if (!university) throw new NotFoundException('University not found');
    if (!(await this.repository.isVisible(id, universityScope(user))))
      throw new ForbiddenException('University is outside your scope');
    return university;
  }

  async create(user: AuthUser, name: string) {
    if (!catalogName(name))
      throw new BadRequestException('University name is required');
    try {
      return await this.repository.create(catalogName(name), user.id);
    } catch (error) {
      rethrow(error);
    }
  }

  async update(user: AuthUser, id: string, name: string) {
    if (!catalogName(name))
      throw new BadRequestException('University name is required');
    await this.get(user, id);
    try {
      return await this.repository.update(id, catalogName(name));
    } catch (error) {
      rethrow(error);
    }
  }

  async listContacts(user: AuthUser, universityId: string) {
    await this.get(user, universityId);
    return this.repository.listContacts(universityId);
  }

  private contactData(
    data: ContactDto,
    existing?: { email: string | null; phone: string | null },
  ) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Contact name is required');
    const email =
      data.email === undefined
        ? (existing?.email ?? null)
        : data.email?.trim() || null;
    const phone =
      data.phone === undefined
        ? (existing?.phone ?? null)
        : data.phone?.trim() || null;
    if (!email && !phone)
      throw new BadRequestException('Email or phone is required');
    return { name, email, phone };
  }

  async createContact(user: AuthUser, universityId: string, data: ContactDto) {
    await this.get(user, universityId);
    return this.repository.createContact(universityId, this.contactData(data));
  }

  async updateContact(
    user: AuthUser,
    universityId: string,
    contactId: string,
    data: ContactDto,
  ) {
    await this.get(user, universityId);
    const contact = await this.repository.findContact(contactId);
    if (!contact || contact.universityId !== universityId)
      throw new NotFoundException('Contact not found');
    return this.repository.updateContact(
      contactId,
      this.contactData(data, contact),
    );
  }

  async setPrimaryContact(
    user: AuthUser,
    universityId: string,
    contactId: string,
  ) {
    await this.get(user, universityId);
    const contact = await this.repository.findContact(contactId);
    if (!contact || contact.universityId !== universityId)
      throw new BadRequestException('Contact belongs to another university');
    return this.repository.setPrimaryContact(universityId, contactId);
  }

  async listAssignments(user: AuthUser, universityId: string) {
    await this.get(user, universityId);
    const assignments = await this.repository.listAssignments(universityId);
    return Promise.all(
      assignments.map(async (assignment) => {
        const profile = await this.directory.profile(
          assignment.user.keycloakSubject,
        );
        const { displayNameOverride, ...stored } = assignment.user;
        return {
          ...assignment,
          user: {
            keycloakSubject: stored.keycloakSubject,
            displayName:
              displayNameOverride ?? profile?.name ?? stored.displayName,
            email: profile?.email || stored.email,
          },
        };
      }),
    );
  }

  async assign(user: AuthUser, universityId: string, subject: string) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.get(user, universityId);
    if (!(await this.directory.isKam(subject)))
      throw new BadRequestException('Existing KAM required');
    const userId = await this.auth.ensureUser(subject);
    await this.repository.assign(universityId, userId);
    return this.listAssignments(user, universityId);
  }

  async unassign(user: AuthUser, universityId: string, subject: string) {
    if (user.level < 20)
      throw new ForbiddenException('Supervisor role required');
    await this.get(user, universityId);
    const assignments = await this.repository.listAssignments(universityId);
    const assignment = assignments.find(
      (item) => item.user.keycloakSubject === subject,
    );
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.repository.unassign(universityId, assignment.userId);
    return this.listAssignments(user, universityId);
  }
}
