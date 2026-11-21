import type { ImportJobStatus } from '@cod/shared';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';
import type { ActivityActor } from './product-activity.port';

/** A `link` row of `catalog_import_job` (D2210, D2214): the link and the Draft product it made. */
export interface LinkImportRecord {
  readonly id: string;
  readonly status: ImportJobStatus;
  readonly sourceUrl: string;
  readonly productId: string | null;
}

/** A link import that made its product: recorded `done` in the product's transaction. */
export interface NewLinkImport {
  readonly id: string;
  readonly sourceUrl: string;
  readonly productId: string;
  readonly actorAdministratorId: number;
  readonly at: Date;
}

/**
 * The link import rows of a store through `TenantRepository` (ADR 0002): every call names the scope, matches only the
 * scope's store and the `link` kind, and joins the transaction `ctx` carries.
 */
export interface LinkJobStore {
  create(ctx: OperationContext, scope: StoreScope, job: NewLinkImport): Promise<void>;
  /** The link import of the scope's store, or `undefined` (another store's or business's, a spreadsheet, none). */
  byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<LinkImportRecord | undefined>;
}

/** Where a product made from a link came from: source `link`, flagged for image review (D2214). */
export interface LinkedOrigin {
  readonly productId: string;
  readonly importJobId: string;
  readonly imageUrls: readonly string[];
}

/** One link import's activity row (action `catalog.products.link-import`, entity `catalog-job`). */
export interface LinkImportActivity {
  readonly scope: StoreScope;
  readonly importId: string;
  readonly productId: string;
  readonly imageCount: number;
  readonly actor: ActivityActor;
}

/** The business activity log, written in the caller's transaction. */
export interface LinkImportActivityPort {
  recordLinkImport(ctx: OperationContext, activity: LinkImportActivity): Promise<void>;
}
