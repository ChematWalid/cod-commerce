import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * Runs work atomically for one business (D2213): every port call given the transactional context joins it, so a
 * product write and its activity row commit or roll back together. It joins a transaction `ctx` already carries.
 */
export interface UnitOfWorkPort {
  run<T>(ctx: OperationContext, scope: TenantScope, work: (transactional: OperationContext) => Promise<T>): Promise<T>;
}
