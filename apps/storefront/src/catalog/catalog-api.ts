import { internalFetch } from '../lib/internal-api';
import type { VerifiedTenant } from '../tenancy/verified-tenant';

const NOT_FOUND = 404;

/** The api could not answer a catalog read: not a 404, so an outage never renders as an empty store. */
export class CatalogApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

/** A shared contract schema, reduced to what a read needs (the storefront does not depend on zod itself). */
export interface ResponseParser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/**
 * Reads `path` from the api's public catalog as the verified store: the signed `x-store-id` names it, so the api
 * answers that store's catalog only (D3201). Only a {@link VerifiedTenant} can be passed, so a crafted tenant path
 * never reaches the api.
 *
 * @returns the parsed body, or `null` for a 404 (unknown, hidden or refused)
 * @throws CatalogApiError for any other status or a body the shared contract refuses
 */
export async function fetchCatalog<T>(
  tenant: VerifiedTenant,
  path: string,
  parser: ResponseParser<T>,
): Promise<T | null> {
  const response = await internalFetch(path, { storeId: tenant.storeId });
  if (response.status === NOT_FOUND) return null;
  if (!response.ok) throw new CatalogApiError(`GET ${path} answered ${String(response.status)}`);
  const parsed = parser.safeParse(await response.json());
  if (!parsed.success) throw new CatalogApiError(`GET ${path} answered an unexpected shape`);
  return parsed.data;
}
