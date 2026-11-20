import { moneySchema } from '@cod/shared';
import { LIST_PRICE_SOURCE } from '../domain/constants';
import type { CoreId } from '../domain/core-id';
import { InvalidUnitPriceError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type {
  GatedLine,
  ResolvedUnitPrice,
  ResolverPrice,
  UnitPriceResolver,
  UnitPriceResolverRegistrar,
  UnitPriceSource,
} from '../domain/ports/unit-price-resolver.port';
import type { GatedVariant, VariantGate } from '../domain/ports/variant-gate.port';
import type { StoreScope } from '../domain/store-scope';

const isWholeDzd = (value: number): boolean => moneySchema.safeParse(value).success;
const isWeight = (value: number | undefined): boolean =>
  value === undefined || (Number.isSafeInteger(value) && value >= 0);

/** A resolver's own label: the list-price source is reserved, so `'variant'` always means the gate's list price. */
const isResolverSource = (source: unknown): source is string =>
  typeof source === 'string' && source.length > 0 && source !== LIST_PRICE_SOURCE;

/** The resolver's answer, checked and copied field by field so nothing else it returns travels on. */
function checkedPrice(resolverKey: string, variantId: string, answer: unknown): ResolverPrice {
  if (typeof answer !== 'object' || answer === null) throw new InvalidUnitPriceError(resolverKey, variantId);
  const { unitPrice, originalPrice, source, weightGrams } = answer as ResolverPrice;
  const valid = isWholeDzd(unitPrice) && isWholeDzd(originalPrice) && isWeight(weightGrams) && isResolverSource(source);
  if (!valid) throw new InvalidUnitPriceError(resolverKey, variantId);
  return weightGrams === undefined
    ? { unitPrice, originalPrice, source }
    : { unitPrice, originalPrice, source, weightGrams };
}

/** The gate's list price; a value outside whole DZD fails loud rather than pricing the line wrongly. */
function listPriceOf(variant: GatedVariant): ResolverPrice {
  if (!isWholeDzd(variant.listPrice)) throw new InvalidUnitPriceError(LIST_PRICE_SOURCE, variant.variantId);
  return { unitPrice: variant.listPrice, originalPrice: variant.listPrice, source: LIST_PRICE_SOURCE };
}

const lineOf = (variant: GatedVariant): GatedLine => ({ productId: variant.productId, variantId: variant.variantId });

/**
 * The unit prices of a cart (D2423): the store-channel variant gate runs first and alone decides which variants are
 * available and which product each belongs to; registered resolvers then run in registration order over the lines
 * still unpriced, the first answer wins, and the list price prices the rest. A resolver only contributes a price: the
 * variant and product of every result come from the gate.
 */
export class UnitPriceRegistry implements UnitPriceResolverRegistrar, UnitPriceSource {
  private readonly resolvers: UnitPriceResolver[] = [];

  constructor(private readonly gate: VariantGate) {}

  register(resolver: UnitPriceResolver): void {
    if (this.resolvers.some((registered) => registered.key === resolver.key)) {
      throw new Error(`A unit price resolver "${resolver.key}" is already registered`);
    }
    this.resolvers.push(resolver);
  }

  async pricesOf(
    ctx: OperationContext,
    scope: StoreScope,
    variantIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, ResolvedUnitPrice>> {
    const gated = [...(await this.gate.accept(ctx, scope, variantIds)).values()];
    const claimed = await this.claimedPrices(ctx, scope, gated);
    return new Map(
      gated.map((variant) => [
        variant.variantId,
        {
          ...(claimed.get(variant.variantId) ?? listPriceOf(variant)),
          variantId: variant.variantId,
          productId: variant.productId,
        },
      ]),
    );
  }

  /** The prices resolvers claim, by variant id; each resolver is asked only for lines no earlier one priced. */
  private async claimedPrices(
    ctx: OperationContext,
    scope: StoreScope,
    gated: readonly GatedVariant[],
  ): Promise<ReadonlyMap<string, ResolverPrice>> {
    const claimed = new Map<string, ResolverPrice>();
    for (const resolver of this.resolvers) {
      const pending = gated.filter((variant) => !claimed.has(variant.variantId));
      if (pending.length === 0) break;
      const answers = await resolver.resolve(ctx, scope, pending.map(lineOf));
      for (const { variantId } of pending) {
        if (!answers.has(variantId)) continue;
        claimed.set(variantId, checkedPrice(resolver.key, variantId, answers.get(variantId)));
      }
    }
    return claimed;
  }
}
