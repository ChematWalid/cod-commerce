import { QUANTITY_RULE_MAX } from '@cod/shared';
import { MIN_ORDER_QUANTITY } from './constants';
import { InvalidCatalogInputError } from './errors';

/** The raw quantity rules of a product, as the settings carry them. */
export interface QuantityRulesInput {
  readonly enabled: boolean;
  readonly min: number;
  readonly step: number;
}

const isRuleBound = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_ORDER_QUANTITY && value <= QUANTITY_RULE_MAX;

/** Quantities a buyer may order when enabled: `min`, `min + step`, `min + 2·step`… (AC5). */
export class QuantityRules {
  private constructor(
    readonly enabled: boolean,
    readonly min: number,
    readonly step: number,
  ) {}

  /**
   * Validates the rules; `min` and `step` are whole numbers from 1 to `QUANTITY_RULE_MAX`, even when disabled, so
   * turning them on later never meets a broken value.
   *
   * @throws {InvalidCatalogInputError} when `min` or `step` is out of bounds.
   */
  static create({ enabled, min, step }: QuantityRulesInput): QuantityRules {
    if (!isRuleBound(min) || !isRuleBound(step)) {
      throw new InvalidCatalogInputError();
    }
    return new QuantityRules(enabled, min, step);
  }
}

/** True when a buyer may order `quantity`: a whole number from 1 that, with rules on, is `min + k·step`. */
export function allowsQuantity(rules: QuantityRules, quantity: number): boolean {
  if (!Number.isInteger(quantity) || quantity < MIN_ORDER_QUANTITY) {
    return false;
  }
  if (!rules.enabled) {
    return true;
  }
  return quantity >= rules.min && (quantity - rules.min) % rules.step === 0;
}
