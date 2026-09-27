import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogRepository,
  type CatalogKind,
} from '../repositories/catalog.repository.js';

function kindOf(value: string): CatalogKind {
  if (value === 'directions' || value === 'programs' || value === 'products')
    return value;
  throw new BadRequestException('Unknown catalog');
}

function handleCatalogError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'P2002')
      throw new ConflictException('Name already exists');
    if (error.code === 'P2025')
      throw new NotFoundException('Catalog item not found');
  }
  throw error;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CatalogRepository) private readonly repository: CatalogRepository,
  ) {}

  list(kind: string) {
    return this.repository.list(kindOf(kind));
  }

  async create(kind: string, name: string) {
    if (!name.trim()) throw new BadRequestException('Name is required');
    try {
      return await this.repository.create(kindOf(kind), name.trim());
    } catch (error) {
      handleCatalogError(error);
    }
  }

  async update(kind: string, id: string, name: string) {
    if (!name.trim()) throw new BadRequestException('Name is required');
    try {
      return await this.repository.update(kindOf(kind), id, name.trim());
    } catch (error) {
      handleCatalogError(error);
    }
  }
}
