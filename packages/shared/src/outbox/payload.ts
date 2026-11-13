import { DomainError } from '../errors/domain-error';

/** The most bytes a payload may take once serialised as JSON (D104). */
export const OUTBOX_PAYLOAD_MAX_BYTES = 4096;

/**
 * What an outbox event carries: ids and small facts, never a nested document. Consumers load what else they need
 * under their own tenant scope.
 */
export type OutboxPayload = Readonly<Record<string, string | number | boolean | null>>;

/** Keys that name a credential; a payload is stored and replayed, so none may travel in it (D104). */
const FORBIDDEN_KEY = /password|secret|token|otp|authorization|cookie|api.?key/i;

/** A payload the outbox refuses; the message names the reason and a key at most, never a value. */
export class OutboxPayloadRejectedError extends DomainError {
  readonly code = 'outbox.payload-rejected';

  constructor(reason: string) {
    super(`Outbox payload rejected: ${reason}`);
  }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

/**
 * Checks a payload and returns it typed.
 * @throws OutboxPayloadRejectedError unless it is a flat record of strings, finite numbers, booleans and null, with
 * no credential-like key, taking at most {@link OUTBOX_PAYLOAD_MAX_BYTES} bytes as JSON.
 */
export function validateOutboxPayload(payload: unknown): OutboxPayload {
  if (!isPlainRecord(payload)) throw new OutboxPayloadRejectedError('it is not a flat record');
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEY.test(key)) throw new OutboxPayloadRejectedError(`the key "${key}" names a credential`);
    if (!isScalar(value))
      throw new OutboxPayloadRejectedError(`the value of "${key}" is not a string, number, boolean or null`);
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).length > OUTBOX_PAYLOAD_MAX_BYTES) {
    throw new OutboxPayloadRejectedError(`it takes more than ${String(OUTBOX_PAYLOAD_MAX_BYTES)} bytes`);
  }
  return payload as OutboxPayload;
}
