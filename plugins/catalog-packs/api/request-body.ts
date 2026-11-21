import { type PackCommand, packInputSchema } from '@cod/shared';
import { InvalidPackInputError } from '../domain/errors';
import type { PackDefinition } from '../domain/pack';

/**
 * Parses a pack body or GraphQL input with the shared schema (ADR 0017 §1, D2223).
 *
 * @throws {InvalidPackInputError} for any refusal, the reused catalog pieces' included, naming no value.
 */
export function parsePackInput(input: unknown): PackCommand {
  const parsed = packInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidPackInputError();
  return parsed.data;
}

/** The definition a parsed command describes: absent fields of another mode are `null`. */
export function definitionOf(command: PackCommand): PackDefinition {
  return {
    packPricingMode: command.packPricingMode,
    packFixedPrice: command.packFixedPrice ?? null,
    packDiscountType: command.packDiscountType ?? null,
    packDiscountValue: command.packDiscountValue ?? null,
    packVariantMode: command.packVariantMode,
    packSharedOption: command.packSharedOption ?? null,
    packWeightMode: command.packWeightMode,
    packFixedWeightGrams: command.packFixedWeightGrams ?? null,
    components: command.components.map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
    })),
  };
}

/**
 * A route or argument id as text. GraphQL `ID` arguments arrive decoded (a number, or -1 for text that names no row);
 * the use cases parse it and answer "not found" for any malformed one (D2136).
 */
export function idArgOf(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input) : '';
}
