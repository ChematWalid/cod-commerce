import type { TenantRepository, TenantRepositoryFactory, TenantTransaction } from '@cod/plugin-tenancy';
import type { Snowflake, TenantScope } from '@cod/shared';
import { In } from 'typeorm';
import type { OfferRecord } from '../domain/offer-record';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OfferListFilter, OfferRepositoryPort } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';
import type { StoreScope } from '../domain/store-scope';
import { OfferEntity } from './offer.entity';
import { editableRowOf, offerRowOf, targetRowsOf, toOfferRecord } from './offer-rows';
import { OfferTargetEntity } from './offer-target.entity';
import { inTenantTransaction, requestScope } from './request-scope';
import { inStore } from './store-where';

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

  async list(ctx: OperationContext, scope: StoreScope, filter: OfferListFilter): Promise<readonly OfferRecord[]> {
    const status = filter.status === undefined ? {} : { status: filter.status };
    const rows = await this.offers.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), ...status },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return this.withTargets(ctx, scope, rows);
  }

  async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    // Targets and codes go with their offer through the composite foreign keys (ON DELETE CASCADE).
    const deleted = await this.offers.delete(requestScope(ctx, scope), { ...inStore(scope), id });
    return deleted > 0;
  }

  activeOf(ctx: OperationContext, scope: StoreScope): Promise<readonly OfferRecord[]> {
    return this.list(ctx, scope, { status: 'active' });
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
