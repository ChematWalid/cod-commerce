import {
  type DeliveryFeeCommuneRatesInput,
  deliveryFeeCommuneRatesInputSchema,
  type DeliveryFeeGroupInput,
  deliveryFeeGroupInputSchema,
  type DeliveryFeeGroupListQuery,
  deliveryFeeGroupListQuerySchema,
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
