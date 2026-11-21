import type { BulkEditChangedField } from '@cod/shared';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** Who asked for a change and from where, as an activity row keeps it. */
export interface ActivityActor {
  readonly administratorId: number;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** One product's bulk-edit activity row: its store, the product and the fields that changed (D2213). */
export interface ProductBulkEditActivity {
  readonly scope: StoreScope;
  readonly productId: string;
  readonly changedFields: readonly BulkEditChangedField[];
  readonly actor: ActivityActor;
}

/** The business activity log, written in the caller's transaction: the row commits or rolls back with the work. */
export interface ProductActivityPort {
  recordBulkEdit(ctx: OperationContext, activity: ProductBulkEditActivity): Promise<void>;
}
