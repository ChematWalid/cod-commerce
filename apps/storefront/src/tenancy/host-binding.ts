import { createHmac, timingSafeEqual } from 'node:crypto';
import type { InternalSigningKey } from '@cod/shared/internal-auth';
import type { NormalizedHost } from './host';

/** The derivation label of the binding keys: a binding key is never the internal request key itself (D3202). */
export const HOST_BINDING_KEY_LABEL = 'storefront-host-binding-v1';

/** How many base64url characters of the HMAC a binding keeps: 22 characters carry 132 bits. */
export const HOST_BINDING_LENGTH = 22;

/** Exactly what {@link hostBindingOf} produces: 22 base64url characters. */
const HOST_BINDING_FORMAT = new RegExp(`^[A-Za-z0-9_-]{${String(HOST_BINDING_LENGTH)}}$`);

/** The key a binding is signed with, derived from one configured internal HMAC key (no new secret, D3202). */
function bindingKeyOf(key: InternalSigningKey): Buffer {
  return createHmac('sha256', key.secret).update(HOST_BINDING_KEY_LABEL).digest();
}

/**
 * The host binding of `storeId` on `host` under `key`: the first 22 base64url characters of
 * `HMAC-SHA256(HMAC(key, label), storeId + '\n' + host)`. The proxy puts it in the tenant path, and the tenant layout
 * recomputes it, so a path naming store B can only come from a rewrite on B's own host (#209).
 */
export function hostBindingOf(key: InternalSigningKey, storeId: string, host: NormalizedHost): string {
  return createHmac('sha256', bindingKeyOf(key))
    .update(`${storeId}\n${host}`)
    .digest('base64url')
    .slice(0, HOST_BINDING_LENGTH);
}

/** Whether `binding` has the form of a binding at all: a cheap check that needs no key and no store. */
export function isHostBindingFormat(binding: string): boolean {
  return HOST_BINDING_FORMAT.test(binding);
}

function sameBinding(expected: string, candidate: string): boolean {
  return timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
}

/**
 * Whether `binding` is the binding of `storeId` on `host` under any of `keys`: a binding signed with a kid that is
 * still configured stays valid during a key rotation. The comparison takes constant time.
 */
export function isHostBindingValid(
  keys: readonly InternalSigningKey[],
  storeId: string,
  host: NormalizedHost,
  binding: string,
): boolean {
  if (!isHostBindingFormat(binding)) return false;
  return keys.some((key) => sameBinding(hostBindingOf(key, storeId, host), binding));
}
