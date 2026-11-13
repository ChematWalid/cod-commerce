import type { BusinessId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The businesses of the platform, as the member converge walks them (D215). */
export interface BusinessDirectoryPort {
  /** Up to `limit` business ids above `afterId` (from the first when absent), in ascending order. */
  page(ctx: OperationContext, afterId: BusinessId | undefined, limit: number): Promise<readonly BusinessId[]>;
}
