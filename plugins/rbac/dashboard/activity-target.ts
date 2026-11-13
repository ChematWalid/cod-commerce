import { ACTIVITY_ENTITY_TYPES, type ActivityEntityType } from '@cod/shared';

const ENTITY_MESSAGE_IDS: Readonly<Record<ActivityEntityType, string>> = {
  [ACTIVITY_ENTITY_TYPES.ROLE]: 'rbac.target-role',
  [ACTIVITY_ENTITY_TYPES.MEMBER]: 'rbac.target-member',
  [ACTIVITY_ENTITY_TYPES.TEAM_MEMBER]: 'rbac.target-team-member',
  [ACTIVITY_ENTITY_TYPES.COMMISSION_CONFIG]: 'rbac.target-commission',
};

function isKnownEntityType(entityType: string): entityType is ActivityEntityType {
  return Object.hasOwn(ENTITY_MESSAGE_IDS, entityType);
}

/** The message naming a row's kind of target, or null for a type no feature writes yet. */
export function targetTypeMessageIdOf(entityType: string): string | null {
  return isKnownEntityType(entityType) ? ENTITY_MESSAGE_IDS[entityType] : null;
}

/** A text field of a diff, either plain (create, delete) or `{ before, after }` (update). */
function textFieldOf(diff: object, field: string): string | null {
  if (!(field in diff)) return null;
  const value: unknown = (diff as Record<string, unknown>)[field];
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null || !('after' in value)) return null;
  return typeof value.after === 'string' ? value.after : null;
}

/**
 * The target's name a diff records: a role's or commission's `name`, or a Team member's `displayName` (D216). Null
 * when it records none, such as an invited member with no name yet.
 */
export function targetNameOf(diff: unknown): string | null {
  if (typeof diff !== 'object' || diff === null) return null;
  return textFieldOf(diff, 'name') ?? textFieldOf(diff, 'displayName');
}
