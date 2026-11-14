import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import type { BrandRepositoryPort } from '../domain/ports/brand-repository.port';
import { BrandEntity } from './brand.entity';
import { TypeOrmCatalogNameRepository } from './typeorm-catalog-name.repository';

/** The Postgres adapter of {@link BrandRepositoryPort}: `catalog_brand` through `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmBrandRepository extends TypeOrmCatalogNameRepository implements BrandRepositoryPort {
  constructor(repositories: TenantRepositoryFactory) {
    super(repositories.for(BrandEntity));
  }
}
