import type { CollectionMode, CollectionRule } from '@cod/shared';
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

/**
 * Sets a collection's mode and rule (D2302). Automatic → manual keeps the current members in their current order as
 * the manual list (refused above the manual cap); a switch to automatic, or a new rule, asks for a recompute; manual
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
    return { definition: { ...definition, mode, rule }, members: 'recompute' };
  }
  if (rule !== null) {
    throw new InvalidCollectionInputError();
  }
  const members = definition.mode === 'manual' ? [...currentMembers] : manualMembers(inCurrentOrder(currentMembers));
  return { definition: { ...definition, mode, rule: null }, members };
}
