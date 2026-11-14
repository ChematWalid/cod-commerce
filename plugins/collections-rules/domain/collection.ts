import { type CollectionMode, type CollectionRule, NORMAL_FORM_VERSION } from '@cod/shared';
import { InvalidCollectionInputError, InvalidCollectionRuleError } from './errors';
import { manualMembers, type MemberRow, newestFirst } from './membership';

/**
 * Our definition of a collection beside its Vendure `Collection` row (D2300): how it gets its products, its rule,
 * the normal-form version its membership was built with (D2336), its visibility and its position in the store.
 */
export interface CollectionDefinition {
  readonly id: string;
  /** The Vendure collection id, an integer in decimal. */
  readonly collectionId: string;
  readonly storeId: string;
  readonly mode: CollectionMode;
  /** Present exactly when `mode` is `automatic`. */
  readonly rule: CollectionRule | null;
  readonly matchVersion: number;
  readonly visible: boolean;
  readonly position: number;
}

/** A definition after a mode or rule change, and its members: kept, or to be recomputed from the rule. */
export interface ModeSwitch {
  readonly definition: CollectionDefinition;
  readonly members: readonly MemberRow[] | 'recompute';
}

/** Members in their current order: by position, then newest product first, as the lists show them (D2318). */
const inCurrentOrder = (members: readonly MemberRow[]): string[] =>
  [...members]
    .sort((left, right) => left.position - right.position || newestFirst(left.productId, right.productId))
    .map((member) => member.productId);

/** Structural equality of two JSON values (a rule as parsed from input or read from its jsonb column), key order aside. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([key, value]) => key in rightRecord && sameJson(value, rightRecord[key]))
  );
}

/**
 * An automatic collection whose rule is unchanged and whose members were built with the current normal form needs no
 * recompute: a save of its title, image, visibility or position must not rebuild the whole store's membership (D2312).
 */
const isUpToDate = (definition: CollectionDefinition, rule: CollectionRule): boolean =>
  definition.mode === 'automatic' && definition.matchVersion === NORMAL_FORM_VERSION && sameJson(definition.rule, rule);

/**
 * Sets a collection's mode and rule (D2302). Automatic → manual keeps the current members in their current order as
 * the manual list (refused above the manual cap); a switch to automatic, a new rule, or members built with an older
 * normal form ask for a recompute; an automatic collection saved with its current rule keeps its members; manual
 * stays manual with its members. An automatic collection needs a rule and a manual one takes none.
 */
export function switchMode(
  definition: CollectionDefinition,
  mode: CollectionMode,
  rule: CollectionRule | null,
  currentMembers: readonly MemberRow[],
): ModeSwitch {
  if (mode === 'automatic') {
    if (rule === null) {
      throw new InvalidCollectionRuleError();
    }
    if (isUpToDate(definition, rule)) {
      return { definition, members: [...currentMembers] };
    }
    return { definition: { ...definition, mode, rule }, members: 'recompute' };
  }
  if (rule !== null) {
    throw new InvalidCollectionInputError();
  }
  const members = definition.mode === 'manual' ? [...currentMembers] : manualMembers(inCurrentOrder(currentMembers));
  return { definition: { ...definition, mode, rule: null }, members };
}
