import type { OperationContext } from '../domain/ports/operation-context';
import { type Snowflake, type StoreId, type TenantScope, toSnowflake } from '@cod/shared';
import {
  ActivityCursorInvalidError,
  type ActivityQuery,
  type ActivityRecord,
  parseVendureId,
} from '../domain/activity';
import { ACTIVITY_DEFAULT_PAGE_SIZE, ACTIVITY_MAX_PAGE_SIZE, ALL_STORES_SCOPE } from '../domain/constants';
import type { ActivityLogPort } from '../domain/ports/activity-log.port';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import { holdsAllAccess } from '../domain/store-access';

/** What a caller asks of the log; ids are the decimal text clients send. */
export interface ActivityLogRequest {
  readonly first?: number;
  readonly after?: string;
  readonly actorAdministratorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  /** The stores the caller can reach today (D65). */
  readonly visibleStoreIds: readonly StoreId[];
  /** Who asks: a member with all-stores access also sees the rows of archived stores. */
  readonly viewerAdministratorId: number;
}

/** A row with the name of whoever did it. */
export interface ActivityItem extends Omit<ActivityRecord, 'actorAdministratorId'> {
  readonly actor: { readonly id: string; readonly name: string } | null;
}

/** One page, and the cursor of the next when more rows follow. */
export interface ActivityPage {
  readonly items: readonly ActivityItem[];
  readonly nextCursor: string | null;
}

const EMPTY_PAGE: ActivityPage = { items: [], nextCursor: null };

function pageSize(first: number | undefined): number {
  return Math.min(Math.max(Math.trunc(first ?? ACTIVITY_DEFAULT_PAGE_SIZE), 1), ACTIVITY_MAX_PAGE_SIZE);
}

function cursorOf(after: string | undefined): Snowflake | undefined {
  if (after === undefined) return undefined;
  try {
    return toSnowflake(after);
  } catch {
    throw new ActivityCursorInvalidError();
  }
}

/** Reads the activity log of the caller's business, newest first, one page at a time. */
export class GetActivityLogService {
  constructor(
    private readonly log: ActivityLogPort,
    private readonly actors: ActorDirectoryPort,
    private readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator'>,
  ) {}

  /**
   * One page of the log. An administrator id that cannot be real names no one, so the page is empty.
   *
   * @throws {@link ActivityCursorInvalidError} when `after` is not an activity id
   */
  async list(ctx: OperationContext, scope: TenantScope, request: ActivityLogRequest): Promise<ActivityPage> {
    const actor = request.actorAdministratorId === undefined ? undefined : parseVendureId(request.actorAdministratorId);
    if (request.actorAdministratorId !== undefined && actor === undefined) return EMPTY_PAGE;
    const limit = pageSize(request.first);
    const query: ActivityQuery = {
      limit: limit + 1,
      before: cursorOf(request.after),
      actorAdministratorId: actor,
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      visibleStoreIds: await this.visibleStores(ctx, scope, request),
    };
    const rows = await this.log.list(ctx, scope, query);
    const page = rows.slice(0, limit);
    return {
      items: await this.withActors(ctx, scope, page),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private async visibleStores(
    ctx: OperationContext,
    scope: TenantScope,
    { viewerAdministratorId, visibleStoreIds }: ActivityLogRequest,
  ): Promise<ActivityQuery['visibleStoreIds']> {
    const held = await this.assignments.ofAdministrator(ctx, scope, viewerAdministratorId);
    return holdsAllAccess(held) ? ALL_STORES_SCOPE : visibleStoreIds;
  }

  private async withActors(
    ctx: OperationContext,
    scope: TenantScope,
    rows: readonly ActivityRecord[],
  ): Promise<ActivityItem[]> {
    const ids = [
      ...new Set(rows.flatMap((row) => (row.actorAdministratorId === null ? [] : [row.actorAdministratorId]))),
    ];
    const names = ids.length === 0 ? new Map<number, string>() : await this.actors.namesOf(ctx, scope, ids);
    return rows.map(({ actorAdministratorId, ...row }) => ({
      ...row,
      actor:
        actorAdministratorId === null
          ? null
          : { id: String(actorAdministratorId), name: names.get(actorAdministratorId) ?? '' },
    }));
  }
}
