import type { TenantRepository, TenantRepositoryFactory, TenantTransaction } from '@cod/plugin-tenancy';
import { type Snowflake, toSnowflake } from '@cod/shared';
import { In } from 'typeorm';
import { normaliseCode } from '../domain/engine/codes';
import { OfferNotFoundError } from '../domain/errors';
import type { StoredCode } from '../domain/offer-record';
import type { OfferCodeRepositoryPort } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { translateCodeTaken } from './code-taken';
import { OfferCodeEntity } from './offer-code.entity';
import { OfferEntity } from './offer.entity';
import { inTenantTransaction, requestScope } from './request-scope';
import { inStore } from './store-where';

function toStoredCode(row: OfferCodeEntity): StoredCode {
  const { id, offerId, code, usageLimit, usageCount, createdAt } = row;
  return { id: toSnowflake(id), offerId: toSnowflake(offerId), code, usageLimit, usageCount, createdAt };
}

/**
 * The Postgres adapter of {@link OfferCodeRepositoryPort}: `offers_code` through `TenantRepository` (ADR 0002). A
 * code's offer is looked up in the scope's store before the write, and the composite foreign key holds it there too.
 */
export class TypeOrmOfferCodeRepository implements OfferCodeRepositoryPort {
  private readonly codes: TenantRepository<OfferCodeEntity>;
  private readonly offers: TenantRepository<OfferEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly transaction: TenantTransaction,
  ) {
    this.codes = repositories.for(OfferCodeEntity);
    this.offers = repositories.for(OfferEntity);
  }

  async add(ctx: OperationContext, scope: StoreScope, codes: readonly StoredCode[]): Promise<void> {
    const store = inStore(scope);
    if (codes.length === 0) return;
    await inTenantTransaction(this.transaction, ctx, scope, async (tenant) => {
      const offerIds = [...new Set(codes.map((code) => code.offerId))];
      const owned = await this.offers.count(tenant, { ...store, id: In(offerIds) });
      if (owned < offerIds.length) throw new OfferNotFoundError();
      for (const code of codes) await translateCodeTaken(this.codes.insert(tenant, { ...code, ...store }));
    });
  }

  async remove(ctx: OperationContext, scope: StoreScope, offerId: Snowflake, code: string): Promise<boolean> {
    const where = { ...inStore(scope), offerId, code: normaliseCode(code) };
    const deleted = await this.codes.delete(requestScope(ctx, scope), where);
    return deleted > 0;
  }

  async listOf(ctx: OperationContext, scope: StoreScope, offerId: Snowflake): Promise<readonly StoredCode[]> {
    const rows = await this.codes.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), offerId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toStoredCode);
  }

  async findByCodes(
    ctx: OperationContext,
    scope: StoreScope,
    codes: readonly string[],
  ): Promise<readonly StoredCode[]> {
    const texts = [...new Set(codes.map(normaliseCode))];
    if (texts.length === 0) return [];
    const rows = await this.codes.find(requestScope(ctx, scope), { where: { ...inStore(scope), code: In(texts) } });
    return rows.map(toStoredCode);
  }
}
