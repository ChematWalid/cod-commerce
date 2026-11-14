import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import type { OrderManagerCheck } from '../../domain/ports/order-manager-check.port';

/** One question the catalog asked the check. */
export interface OrderManagerQuestion {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly ids: readonly Snowflake[];
}

/**
 * Team's order-manager check as a fake: `members` maps a member id to the stores it manages (`'all'` for every store
 * of its business); anyone else is unknown. It records each question so a test sees which store was asked about.
 */
export class FakeOrderManagerCheck implements OrderManagerCheck {
  readonly questions: OrderManagerQuestion[] = [];

  constructor(
    private readonly members: ReadonlyMap<string, { businessId: string; stores: readonly string[] | 'all' }>,
    private readonly callerStores: ReadonlySet<StoreId> | 'all' = 'all',
  ) {}

  unknownIds(
    _ctx: unknown,
    businessId: BusinessId,
    storeId: StoreId,
    ids: readonly Snowflake[],
  ): Promise<readonly Snowflake[]> {
    this.questions.push({ businessId, storeId, ids });
    return Promise.resolve(ids.filter((id) => !this.manages(id, businessId, storeId)));
  }

  accessibleStoreIds(): Promise<ReadonlySet<StoreId> | 'all'> {
    return Promise.resolve(this.callerStores);
  }

  private manages(id: string, businessId: string, storeId: string): boolean {
    const member = this.members.get(id);
    if (member?.businessId !== businessId) return false;
    return member.stores === 'all' || member.stores.includes(storeId);
  }
}
