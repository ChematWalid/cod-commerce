import { canonicalCoreId } from '../domain/core-id';
import { CollectionImageNotFoundError, CollectionSlugTakenError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionPorts } from './collection-ports';

/** The sanitised description (D2322); a blank result, or none, is no description. */
export function cleanDescription(
  ports: Pick<CollectionPorts, 'sanitizer'>,
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const clean = ports.sanitizer.sanitize(raw).trim();
  return clean === '' ? null : clean;
}

/** @throws {CollectionSlugTakenError} when another collection of the store uses the slug (D2319, no silent suffix). */
export async function refuseTakenSlug(
  ports: Pick<CollectionPorts, 'vendure'>,
  ctx: OperationContext,
  slug: string,
  exceptId?: string,
): Promise<void> {
  if (await ports.vendure.slugTaken(ctx, slug, exceptId)) throw new CollectionSlugTakenError();
}

/**
 * The image id as stored, or `null` for none (D2320). A malformed id never reaches the database.
 *
 * @throws {CollectionImageNotFoundError} when the id is malformed or not an asset of the store.
 */
export async function checkedImageId(
  ports: Pick<CollectionPorts, 'vendure'>,
  ctx: OperationContext,
  raw: string | null | undefined,
): Promise<string | null> {
  if (raw === null || raw === undefined) return null;
  const assetId = canonicalCoreId(raw);
  if (assetId === undefined || !(await ports.vendure.assetExists(ctx, assetId))) {
    throw new CollectionImageNotFoundError();
  }
  return assetId;
}
