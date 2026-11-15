import type { CollectionRule, RuleCondition } from '@cod/shared';
import type { StoreCollectionPage, StoreCollectionView } from '../application/collection-view';

/** One condition as the API shows it: every field of every kind, the ones a kind does not use `null`. */
export interface StoreCollectionConditionDto {
  readonly field: string;
  readonly operator: string;
  readonly option: string | null;
  readonly values: readonly string[] | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly value: boolean | null;
}

/** A stored rule (`StoreCollectionRule`). */
export interface StoreCollectionRuleDto {
  readonly version: number;
  readonly match: string;
  readonly conditions: readonly StoreCollectionConditionDto[];
}

/** A store collection (`StoreCollection`). */
export interface StoreCollectionDto extends Omit<StoreCollectionView, 'rule'> {
  readonly rule: StoreCollectionRuleDto | null;
}

/** A page of the admin list (`StoreCollectionList`). */
export interface StoreCollectionListDto {
  readonly items: readonly StoreCollectionDto[];
  readonly totalItems: number;
}

const EMPTY_CONDITION = { option: null, values: null, min: null, max: null, value: null } as const;

/** A condition flattened onto one shape, so GraphQL needs no union per field. */
function toConditionDto(condition: RuleCondition): StoreCollectionConditionDto {
  return { ...EMPTY_CONDITION, ...condition };
}

const toRuleDto = (rule: CollectionRule): StoreCollectionRuleDto => ({
  version: rule.version,
  match: rule.match,
  conditions: rule.conditions.map(toConditionDto),
});

export const toCollectionDto = (view: StoreCollectionView): StoreCollectionDto => ({
  ...view,
  rule: view.rule === null ? null : toRuleDto(view.rule),
});

export const toCollectionListDto = (page: StoreCollectionPage): StoreCollectionListDto => ({
  items: page.items.map(toCollectionDto),
  totalItems: page.totalItems,
});
