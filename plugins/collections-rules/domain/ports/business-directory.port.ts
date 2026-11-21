import type { BusinessId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Every business of the platform, in id order, for the sweeps that visit each one (D2336). Ids only. */
export interface BusinessDirectoryPort {
  /** Up to `limit` business ids above `after` (from the first when `undefined`), ascending. */
  businessIdsAfter(ctx: OperationContext, after: BusinessId | undefined, limit: number): Promise<readonly BusinessId[]>;
}
