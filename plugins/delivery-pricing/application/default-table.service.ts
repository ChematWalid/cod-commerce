import type { Snowflake } from '@cod/shared';
import {
  DEFAULT_CHARGE_OVERWEIGHT,
  DEFAULT_OVERWEIGHT_ALLOWANCE_KG,
  DEFAULT_OVERWEIGHT_RATE,
  PLATFORM_DEFAULT_GROUP_NAME,
} from '../domain/constants';
import { defaultRates } from '../domain/default-prices';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/**
 * The store's seeded "Platform default prices" fee group (D3124): one row per wilaya, all enabled, the default prices
 * as base and no override. The store lifecycle hook and the migrate converge call it (Task 6).
 */
export class DefaultTableService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /** The id of the store's platform default group, created when it has none; idempotent. */
  ensureFor(ctx: OperationContext, scope: StoreScope): Promise<Snowflake> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const existing = await this.ports.groups.platformDefaultId(tx, scope);
      if (existing !== undefined) return existing;
      return this.ports.groups.insert(tx, scope, {
        name: PLATFORM_DEFAULT_GROUP_NAME,
        carrierId: null,
        chargeOverweight: DEFAULT_CHARGE_OVERWEIGHT,
        overweightAllowanceKg: DEFAULT_OVERWEIGHT_ALLOWANCE_KG,
        overweightRate: DEFAULT_OVERWEIGHT_RATE,
        isPlatformDefault: true,
        rates: defaultRates(),
      });
    });
  }
}
