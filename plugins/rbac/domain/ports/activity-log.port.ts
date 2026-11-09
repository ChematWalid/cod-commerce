import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';
import type { ActivityEntry, ActivityQuery, ActivityRecord } from '../activity';

/** The activity log's storage. Append and list only: no update or delete exists (D65). */
export interface ActivityLogPort {
  /** Adds the entry under its scope's business, in the transaction `ctx` carries. */
  append(ctx: OperationContext, entry: ActivityEntry): Promise<void>;

  /** Up to `query.limit` rows of the scope's business, newest first. */
  list(ctx: OperationContext, scope: TenantScope, query: ActivityQuery): Promise<readonly ActivityRecord[]>;
}
