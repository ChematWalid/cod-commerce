import type { ComponentOptionGroup, ComponentVariant } from './component-product';
import { NoCommonValueError, SharedOptionMissingError } from './errors';
import { optionKey } from './option-key';

/** What the shared-option rule reads of a component: its options and its live variants. */
export interface ComponentOptions {
  readonly optionGroups: readonly ComponentOptionGroup[];
  readonly variants: readonly ComponentVariant[];
}

/**
 * The pack's one option (D2202): the values every component sells, in the first component's order and spelling,
 * and for each value the variant of each component that carries it, in component order.
 */
export interface SharedMatrix {
  readonly values: readonly string[];
  readonly variantsByValue: ReadonlyMap<string, readonly string[]>;
}

/** The variant ids of `component` by the key of their one option value. */
function variantsByKey(component: ComponentOptions): ReadonlyMap<string, string> {
  return new Map(component.variants.map((variant) => [optionKey(variant.optionValues[0] ?? ''), variant.id]));
}

/** The variant of each component carrying `value`, or `undefined` when one component sells none. */
function variantsCarrying(value: string, byKey: readonly ReadonlyMap<string, string>[]): string[] | undefined {
  const ids = byKey.map((variants) => variants.get(optionKey(value)));
  return ids.every((id) => id !== undefined) ? ids : undefined;
}

/**
 * The matrix of a `shared_option` pack (D2202): every component must have exactly one option, named `optionName`
 * (compared trimmed, NFC, lower case), and at least one value of it must be sold by every component.
 *
 * @throws {SharedOptionMissingError} when a component lacks the option or has another one beside it.
 * @throws {NoCommonValueError} when no value is sold by every component.
 */
export function sharedOptionMatrix(optionName: string, components: readonly ComponentOptions[]): SharedMatrix {
  const wanted = optionKey(optionName);
  const fits = (component: ComponentOptions) =>
    component.optionGroups.length === 1 && optionKey(component.optionGroups[0]?.name ?? '') === wanted;
  if (components.length === 0 || !components.every(fits)) throw new SharedOptionMissingError();
  const byKey = components.map(variantsByKey);
  const variantsByValue = new Map<string, readonly string[]>();
  for (const value of components[0]?.optionGroups[0]?.values ?? []) {
    const carrying = variantsCarrying(value, byKey);
    if (carrying !== undefined) variantsByValue.set(value, carrying);
  }
  if (variantsByValue.size === 0) throw new NoCommonValueError();
  return { values: [...variantsByValue.keys()], variantsByValue };
}
