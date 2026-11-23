import type { SnowflakeIdGeneratorPort, TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Logger } from '@vendure/core';
import { In, QueryFailedError } from 'typeorm';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SynonymRepositoryPort } from '../domain/ports/synonym-repository.port';
import type { SynonymPair } from '../domain/search-query';
import { requestScope } from './request-scope';
import { StorefrontSearchSynonymEntity } from './storefront-search-synonym.entity';

const LOG_CONTEXT = 'StorefrontSearch';
const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === UNIQUE_VIOLATION;

/**
 * The Postgres adapter of {@link SynonymRepositoryPort} through `TenantRepository` (ADR 0002). A business seeded once is
 * remembered by this process, so later searches skip the count. Two first searches of one business at once may both
 * seed: the unique pair index stops the second, which then leaves the rows to the first.
 */
export class TypeOrmSynonymRepository implements SynonymRepositoryPort {
  private readonly rows: TenantRepository<StorefrontSearchSynonymEntity>;
  private readonly seeded = new Set<string>();

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.rows = repositories.for(StorefrontSearchSynonymEntity);
  }

  async seedIfEmpty(ctx: OperationContext, business: TenantScope, pairs: readonly SynonymPair[]): Promise<void> {
    if (this.seeded.has(business.businessId)) return;
    const tenant = requestScope(ctx, business);
    if ((await this.rows.count(tenant)) === 0) await this.insertAll(tenant, pairs);
    this.seeded.add(business.businessId);
  }

  async matching(
    ctx: OperationContext,
    business: TenantScope,
    words: readonly string[],
  ): Promise<readonly SynonymPair[]> {
    if (words.length === 0) return [];
    const wanted = In([...words]);
    const rows = await this.rows.find(requestScope(ctx, business), {
      where: [{ term: wanted }, { expansion: wanted }],
    });
    return rows.map(({ term, expansion }) => ({ term, expansion }));
  }

  private async insertAll(tenant: TenantScope, pairs: readonly SynonymPair[]): Promise<void> {
    try {
      for (const { term, expansion } of pairs) await this.rows.insert(tenant, { id: this.ids.next(), term, expansion });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      Logger.verbose(`business ${tenant.businessId}: synonyms already being seeded by another search`, LOG_CONTEXT);
    }
  }
}
