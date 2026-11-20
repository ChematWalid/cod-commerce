import type { ExportScope, ImportFormat } from '@cod/shared';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';
import type { ActivityActor } from './product-activity.port';

/** Who ran an export: a job's administrator may be gone by the time the worker runs it (rbac stores no actor then). */
export interface ExportActor extends Omit<ActivityActor, 'administratorId'> {
  readonly administratorId: number | null;
}

/** One export's activity row (action `catalog.products.export`, entity `catalog-job`): what it wrote and for whom. */
export interface ExportActivity {
  readonly scope: StoreScope;
  readonly exportId: string;
  readonly exportScope: ExportScope;
  readonly format: ImportFormat;
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly actor: ExportActor;
}

/** The business activity log, written in the caller's transaction: the row commits with the export's own row. */
export interface ExportActivityPort {
  recordExport(ctx: OperationContext, activity: ExportActivity): Promise<void>;
}
