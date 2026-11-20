import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { MoreThan, Raw } from 'typeorm';
import { normaliseCode } from '../domain/engine/codes';
import type { OfferUsageCounterPort } from '../domain/ports/offer-usage-counter.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { OfferCodeEntity } from './offer-code.entity';
import { OfferEntity } from './offer.entity';
import { requestScope } from './request-scope';
import { inStore } from './store-where';

/** The count is raised and lowered in the row itself, so two orders racing for the last use never both get it. */
const ONE_MORE = () => '"usageCount" + 1';
const ONE_LESS = () => '"usageCount" - 1';

/** A count still under the row's limit column; no limit means every use counts. */
const underLimit = (limitColumn: string) => Raw((count) => `("${limitColumn}" IS NULL OR ${count} < "${limitColumn}")`);

/**
 * The Postgres adapter of {@link OfferUsageCounterPort}: guarded `UPDATE`s of `offers_offer.usageCount` and
 * `offers_code.usageCount` through `TenantRepository` (ADR 0002), in the transaction `ctx` carries.
 */
export class TypeOrmOfferUsageCounter implements OfferUsageCounterPort {
  private readonly offers: TenantRepository<OfferEntity>;
  private readonly codes: TenantRepository<OfferCodeEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.offers = repositories.for(OfferEntity);
    this.codes = repositories.for(OfferCodeEntity);
  }

  async recordOfferUse(ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean> {
    const where = { ...inStore(scope), id: offerId, usageCount: underLimit('totalUsageLimit') };
    return (await this.offers.update(requestScope(ctx, scope), where, { usageCount: ONE_MORE })) > 0;
  }

  async recordCodeUse(ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean> {
    const where = { ...inStore(scope), code: normaliseCode(code), usageCount: underLimit('usageLimit') };
    return (await this.codes.update(requestScope(ctx, scope), where, { usageCount: ONE_MORE })) > 0;
  }

  async releaseOfferUse(ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean> {
    const where = { ...inStore(scope), id: offerId, usageCount: MoreThan(0) };
    return (await this.offers.update(requestScope(ctx, scope), where, { usageCount: ONE_LESS })) > 0;
  }

  async releaseCodeUse(ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean> {
    const where = { ...inStore(scope), code: normaliseCode(code), usageCount: MoreThan(0) };
    return (await this.codes.update(requestScope(ctx, scope), where, { usageCount: ONE_LESS })) > 0;
  }
}
