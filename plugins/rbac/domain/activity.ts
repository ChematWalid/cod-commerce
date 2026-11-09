import { DomainError, type Snowflake, type StoreId, type TenantScope } from '@cod/shared';
import {
  ACTIVITY_ACTION_MAX_LENGTH,
  ACTIVITY_ENTITY_ID_MAX_LENGTH,
  ACTIVITY_ENTITY_TYPE_MAX_LENGTH,
  ACTIVITY_IP_MAX_LENGTH,
  ACTIVITY_SUMMARY_MAX_LENGTH,
  ACTIVITY_USER_AGENT_MAX_LENGTH,
  type ALL_STORES_SCOPE,
  MAX_VENDURE_ID,
} from './constants';

/** The error code of an activity entry that cannot be stored. */
export const ACTIVITY_ENTRY_INVALID_CODE = 'rbac.activity-entry-invalid';
/** The error code of a page cursor that is no activity id. */
export const ACTIVITY_CURSOR_INVALID_CODE = 'rbac.activity-cursor-invalid';

/** Thrown when an entry names no action or entity, or one longer than its column. A programming error of the publisher. */
export class ActivityEntryInvalidError extends DomainError {
  readonly code = ACTIVITY_ENTRY_INVALID_CODE;

  constructor(field: string) {
    super(`Invalid activity entry: ${field}`);
  }
}

/** Thrown when a page cursor is not a snowflake id. */
export class ActivityCursorInvalidError extends DomainError {
  readonly code = ACTIVITY_CURSOR_INVALID_CODE;

  constructor() {
    super('Invalid activity cursor');
  }
}

/** What a publisher says happened. The log adds the id and the time. */
export interface ActivityEntryInput {
  readonly scope: TenantScope;
  readonly storeId?: StoreId;
  readonly actorAdministratorId: number | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;
  readonly diff: Readonly<Record<string, unknown>>;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** An entry as stored: the input with its id and time, its diff already sanitized. */
export interface ActivityEntry extends ActivityEntryInput {
  readonly id: Snowflake;
  readonly createdAt: Date;
}

/** A stored row as a list returns it. */
export interface ActivityRecord {
  readonly id: Snowflake;
  readonly storeId: string | null;
  readonly actorAdministratorId: number | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;
  readonly diff: Readonly<Record<string, unknown>>;
  readonly ip: string | null;
  readonly createdAt: Date;
}

/** One read of the log: newest first, rows below `before`, narrowed by the optional filters. */
export interface ActivityQuery {
  readonly limit: number;
  readonly before?: Snowflake;
  readonly actorAdministratorId?: number;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  /** Rows of a store show only for these stores, or for every store; rows of no store always show (D65). */
  readonly visibleStoreIds: readonly StoreId[] | typeof ALL_STORES_SCOPE;
}

const clip = (text: string, max: number): string => (text.length > max ? text.slice(0, max) : text);

function requireBounded(field: string, value: string, max: number): string {
  if (value.trim() === '' || value.length > max) throw new ActivityEntryInvalidError(field);
  return value;
}

/**
 * Checks the fields that name what happened and clips the free text to its column.
 *
 * @throws {@link ActivityEntryInvalidError} when the action, entity type or entity id is empty or too long
 */
export function normalizeEntry(
  entry: ActivityEntryInput,
): Pick<ActivityEntry, 'action' | 'entityType' | 'entityId' | 'summary' | 'ip' | 'userAgent'> {
  return {
    action: requireBounded('action', entry.action, ACTIVITY_ACTION_MAX_LENGTH),
    entityType: requireBounded('entityType', entry.entityType, ACTIVITY_ENTITY_TYPE_MAX_LENGTH),
    entityId: requireBounded('entityId', entry.entityId, ACTIVITY_ENTITY_ID_MAX_LENGTH),
    summary: clip(entry.summary, ACTIVITY_SUMMARY_MAX_LENGTH),
    ip: entry.ip === null ? null : clip(entry.ip, ACTIVITY_IP_MAX_LENGTH),
    userAgent: entry.userAgent === null ? null : clip(entry.userAgent, ACTIVITY_USER_AGENT_MAX_LENGTH),
  };
}

const VENDURE_ID_FORMAT = /^[1-9][0-9]{0,9}$/;

/** A Vendure id sent as decimal text (D68), or `undefined` when it cannot name a real one. */
export function parseVendureId(text: string): number | undefined {
  if (!VENDURE_ID_FORMAT.test(text)) return undefined;
  const id = Number(text);
  return id > MAX_VENDURE_ID ? undefined : id;
}
