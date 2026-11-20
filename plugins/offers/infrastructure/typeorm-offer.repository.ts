import {
  type TenantRepository,
  type TenantRepositoryFactory,
  type TenantTransaction,
  tenantQuery,
} from '@cod/plugin-tenancy';
import type { OfferStatus, Snowflake, TenantScope } from '@cod/shared';
import { In, type SelectQueryBuilder } from 'typeorm';
import type { OfferRecord } from '../domain/offer-record';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type {
  OfferListFilter,
  OfferPage,
  OfferRepositoryPort,
  OfferTargetRefs,
} from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';
import type { StoreScope } from '../domain/store-scope';
import { OfferEntity } from './offer.entity';
import { editableRowOf, offerRowOf, targetRowsOf, toOfferRecord } from './offer-rows';
import { OfferTargetEntity } from './offer-target.entity';
import { inTenantTransaction, requestScope } from './request-scope';
import { inStore } from './store-where';

/** The query aliases of an offer row and of its target rows. */
const OFFER_ALIAS = 'offer';
const TARGET_ALIAS = 'target';

/** A core id no row holds (ids start at 1): stands in for an empty id list, which SQL `IN ()` cannot express. */
const NO_REF_ID = '0';

/** What the offer repository is built from. */
export interface OfferRepositoryDeps {
  readonly repositories: TenantRepositoryFactory;
  readonly transaction: TenantTransaction;
  readonly ids: IdGeneratorPort;
  readonly logger: PricingLogger;
}

/**
 * The Postgres adapter of {@link OfferRepositoryPort}: `offers_offer` and `offers_offer_target` through
 * `TenantRepository` (ADR 0002); an offer and its targets are written in one tenant transaction.
 */
export class TypeOrmOfferRepository implements OfferRepositoryPort {
  private readonly offers: TenantRepository<OfferEntity>;
  private readonly targets: TenantRepository<OfferTargetEntity>;

  constructor(private readonly deps: OfferRepositoryDeps) {
    this.offers = deps.repositories.for(OfferEntity);
    this.targets = deps.repositories.for(OfferTargetEntity);
  }

  async create(ctx: OperationContext, scope: StoreScope, offer: OfferRecord): Promise<void> {
    const row = offerRowOf(scope, offer);
    await inTenantTransaction(this.deps.transaction, ctx, scope, async (tenant) => {
      await this.offers.insert(tenant, row);
      await this.insertTargets(tenant, scope, offer);
    });
  }

  update(ctx: OperationContext, scope: StoreScope, offer: OfferRecord, expectedVersion: number): Promise<boolean> {
    const { id } = offer;
    const fields = editableRowOf(scope, offer);
    return inTenantTransaction(this.deps.transaction, ctx, scope, async (tenant) => {
      // The version predicate makes a write read before a concurrent one match no row instead of undoing it.
      const changed = await this.offers.update(tenant, { ...inStore(scope), id, version: expectedVersion }, fields);
      if (changed === 0) return false;
      await this.targets.delete(tenant, { ...inStore(scope), offerId: id });
      await this.insertTargets(tenant, scope, offer);
      return true;
    });
  }

  async findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<OfferRecord | undefined> {
    const row = await this.offers.findOne(requestScope(ctx, scope), { ...inStore(scope), id });
    if (row === null) return undefined;
    const [offer] = await this.withTargets(ctx, scope, [row]);
    return offer;
  }

  async list(ctx: OperationContext, scope: StoreScope, filter: OfferListFilter): Promise<OfferPage> {
    const tenant = requestScope(ctx, scope);
    const query = tenantQuery(tenant, this.offers, OFFER_ALIAS).andWhere(`${OFFER_ALIAS}.storeId = :offerStoreId`, {
      offerStoreId: inStore(scope).storeId,
    });
    if (filter.status !== undefined) query.andWhere(`${OFFER_ALIAS}.status = :status`, { status: filter.status });
    if (filter.kind !== undefined) query.andWhere(`${OFFER_ALIAS}.kind = :kind`, { kind: filter.kind });
    if (filter.refs !== undefined) this.targetingOneOf(tenant, scope, query, filter.refs);
    const [rows, totalItems] = await query
      .orderBy(`${OFFER_ALIAS}.createdAt`, 'DESC')
      .addOrderBy(`${OFFER_ALIAS}.id`, 'DESC')
      .skip(filter.skip)
      .take(filter.take)
      .getManyAndCount();
    return { items: await this.withTargets(ctx, scope, rows), totalItems };
  }

  async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake, status?: OfferStatus): Promise<boolean> {
    // Targets and codes go with their offer through the composite foreign keys (ON DELETE CASCADE).
    const onlyIf = status === undefined ? {} : { status };
    const deleted = await this.offers.delete(requestScope(ctx, scope), { ...inStore(scope), id, ...onlyIf });
    return deleted > 0;
  }

  async activeOf(ctx: OperationContext, scope: StoreScope): Promise<readonly OfferRecord[]> {
    // Never paged: the pricing snapshot must see every active offer, not the first page of the admin list. A fixed
    // order keeps the quote's entry-ordered fields (suggestions, skipped) the same from one call to the next.
    const rows = await this.offers.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), status: 'active' },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return this.withTargets(ctx, scope, rows);
  }

  /**
   * Narrows `query` to offers with a target, of any role, on one of `refs` (D2513), through an `EXISTS` on the
   * store's own targets, itself a tenant query: no product or variant id at all matches nothing.
   */
  private targetingOneOf(
    tenant: TenantScope,
    scope: StoreScope,
    query: SelectQueryBuilder<OfferEntity>,
    refs: OfferTargetRefs,
  ): void {
    // An `IN ()` of nothing is invalid SQL, and an empty filter must keep no offer, so a never-matching id stands in.
    const productIds = refs.productIds.length > 0 ? refs.productIds : [NO_REF_ID];
    const variantIds = refs.variantIds.length > 0 ? refs.variantIds : [NO_REF_ID];
    const targets = tenantQuery(tenant, this.targets, TARGET_ALIAS)
      .select('1')
      .andWhere(`${TARGET_ALIAS}.storeId = :targetStoreId`, { targetStoreId: inStore(scope).storeId })
      .andWhere(`${TARGET_ALIAS}.offerId = "${OFFER_ALIAS}"."id"`)
      .andWhere(
        `(${TARGET_ALIAS}.refType = 'product' AND ${TARGET_ALIAS}.refId IN (:...productIds)) OR ` +
          `(${TARGET_ALIAS}.refType = 'variant' AND ${TARGET_ALIAS}.refId IN (:...variantIds))`,
        { productIds, variantIds },
      );
    query.andWhere(`EXISTS (${targets.getQuery()})`, targets.getParameters());
  }

  private async insertTargets(tenant: TenantScope, scope: StoreScope, offer: OfferRecord): Promise<void> {
    for (const target of targetRowsOf(scope, offer, () => this.deps.ids.next())) {
      await this.targets.insert(tenant, target);
    }
  }

  private async withTargets(
    ctx: OperationContext,
    scope: StoreScope,
    rows: readonly OfferEntity[],
  ): Promise<OfferRecord[]> {
    if (rows.length === 0) return [];
    const targets = await this.targets.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), offerId: In(rows.map((row) => row.id)) },
    });
    return rows.map((row) =>
      toOfferRecord(
        row,
        targets.filter((target) => target.offerId === row.id),
        this.deps.logger,
      ),
    );
  }
}
