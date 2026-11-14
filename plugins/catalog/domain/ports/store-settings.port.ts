import type { SoldOutBehavior } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** The store a public read runs in, with the setting that decides what it shows (D2109). */
export interface ActiveStore {
  readonly scope: StoreScope;
  readonly soldOutBehavior: SoldOutBehavior;
}

/** The store of a caller's context, read from tenancy (D2106). */
export interface StoreSettingsPort {
  /**
   * The active store of `ctx` (D2142): the store the tenant guard resolved, whose channel is the context's. `undefined`
   * for a context without a resolved tenant, with another channel than its store's, or of an archived store.
   */
  activeStoreOf(ctx: OperationContext): Promise<ActiveStore | undefined>;
}
