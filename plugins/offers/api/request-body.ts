import { type OfferInput, offerInputSchema } from '@cod/shared';
import { InvalidOfferConfigError } from '../domain/errors';

/** The editable fields of an offer: a patch keeps these keys only, so it never sets a status or a counter. */
const OFFER_INPUT_KEYS: ReadonlySet<string> = new Set(Object.keys(offerInputSchema.shape));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A route or argument id as text. The offers' ids are `String` on GraphQL (D2535); the use cases parse it and answer
 * "not found" for any malformed one.
 */
export function idArgOf(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input) : '';
}

/** The named field of a JSON body, as sent. */
export function fieldOf(body: unknown, name: string): unknown {
  return isPlainObject(body) ? body[name] : undefined;
}

/**
 * An edit of an offer: the body's offer fields only, unchecked here. `OfferAdminService.update` validates the patch
 * merged over the stored offer, so a bad value is refused there with `offers.invalid-config`.
 *
 * @throws {@link InvalidOfferConfigError} when the body is not an object.
 */
export function offerPatchOf(body: unknown): Partial<OfferInput> {
  if (!isPlainObject(body)) throw new InvalidOfferConfigError();
  return Object.fromEntries(Object.entries(body).filter(([key]) => OFFER_INPUT_KEYS.has(key)));
}

/**
 * The version an edit was read at, when the caller sends one (D2535); absent or null means "no check".
 *
 * @throws {@link InvalidOfferConfigError} when it is not a positive whole number.
 */
export function versionOf(input: unknown): number | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) throw new InvalidOfferConfigError();
  return input;
}

/** The object without its null fields: an unset GraphQL argument means "the default", as an absent one does. */
export function withoutNullFields(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null));
}
