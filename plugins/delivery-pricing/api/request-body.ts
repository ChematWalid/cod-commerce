import {
  type DeliveryFeeCommunePricesInput,
  deliveryFeeCommunePricesInputSchema,
  type DeliveryFeeCommuneRatesInput,
  deliveryFeeCommuneRatesInputSchema,
  type DeliveryFeeGroupInput,
  type DeliveryFeeGroupDuplicateInput,
  deliveryFeeGroupDuplicateInputSchema,
  deliveryFeeGroupInputSchema,
  type DeliveryFeeGroupListQuery,
  deliveryFeeGroupListQuerySchema,
  type DeliveryFeePriceAdjustmentInput,
  deliveryFeePriceAdjustmentInputSchema,
} from '@cod/shared';
import { InvalidDeliveryFeeInputError } from '../domain/errors';

/** Parses with `schema`, or throws the one refusal of a delivery-pricing body, naming no value (ADR 0017 §1). */
function parsed<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new InvalidDeliveryFeeInputError();
  return result.data;
}

/** A whole fee group: one rate per wilaya. @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parseFeeGroupInput = (input: unknown): DeliveryFeeGroupInput => parsed(deliveryFeeGroupInputSchema, input);

/** The communes of one wilaya to merge. @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parseCommuneRatesInput = (provinceCode: unknown, rows: unknown): DeliveryFeeCommuneRatesInput =>
  parsed(deliveryFeeCommuneRatesInputSchema, { provinceCode, rows });

/** A "Raise/lower by…" of the selected wilayas (D3140). @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parsePriceAdjustmentInput = (input: unknown): DeliveryFeePriceAdjustmentInput =>
  parsed(deliveryFeePriceAdjustmentInputSchema, input);

/** The prices for every commune of one wilaya (D3140). @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parseCommunePricesInput = (provinceCode: unknown, prices: unknown): DeliveryFeeCommunePricesInput =>
  parsed(deliveryFeeCommunePricesInputSchema, { provinceCode, prices });

/** The name of a copy (D3140). @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parseDuplicateInput = (name: unknown): DeliveryFeeGroupDuplicateInput =>
  parsed(deliveryFeeGroupDuplicateInputSchema, { name });

/** A list page query (GraphQL options or a REST query string). @throws {InvalidDeliveryFeeInputError} otherwise. */
export const parseListQuery = (input: unknown): DeliveryFeeGroupListQuery =>
  parsed(deliveryFeeGroupListQuerySchema, input);

/** A route or argument id as text; the use cases answer "not found" for a malformed one. */
export function idArgOf(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input) : '';
}

/** The named field of a JSON body, as sent. */
export function fieldOf(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

/** How a REST query string spells a dry-run flag. */
const QUERY_BOOLEANS: ReadonlyMap<unknown, boolean> = new Map([
  ['true', true],
  ['false', false],
]);

/**
 * Whether a CSV import is only a dry run (D3142): absent means yes, so no call writes by default; a boolean as sent, or
 * `true`/`false` from a REST query. @throws {InvalidDeliveryFeeInputError} otherwise.
 */
export function parseDryRun(input: unknown): boolean {
  if (input === undefined || input === null) return true;
  if (typeof input === 'boolean') return input;
  const parsedFlag = QUERY_BOOLEANS.get(input);
  if (parsedFlag === undefined) throw new InvalidDeliveryFeeInputError();
  return parsedFlag;
}
