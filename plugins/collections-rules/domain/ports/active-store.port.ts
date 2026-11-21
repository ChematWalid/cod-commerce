import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * The store a request acts on: the session's business and the store of its channel token, never a path or body
 * (ADR 0008, D2142). The adapter refuses a request without one.
 */
export interface ActiveStorePort {
  activeStoreOf(ctx: OperationContext): Promise<StoreScope>;
}
