import type { BrandRepositoryPort } from '../../domain/ports/brand-repository.port';
import { InMemoryCatalogNameRepository } from './in-memory-catalog-name-repository';

/** A store's brands in memory; it passes the brand contract. */
export class InMemoryBrandRepository extends InMemoryCatalogNameRepository implements BrandRepositoryPort {}
