import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * Which store a request prices (D2408): business and store always come from the resolved tenant and the context's
 * channel, never from a request body (ADR 0002).
 */
export interface ActiveStorePort {
  /**
   * The active store of the tenant the guard resolved for the request, when it is active and `ctx` is on its own
   * channel (D2142); `undefined` otherwise.
   */
  activeStoreOf(ctx: OperationContext): Promise<StoreScope | undefined>;

  /** Whether `ctx` is on the channel of `scope`'s store, which belongs to `scope`'s business and is not archived. */
  isChannelOf(ctx: OperationContext, scope: StoreScope): Promise<boolean>;
}
