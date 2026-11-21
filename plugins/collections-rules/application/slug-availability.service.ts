import type { StoreCollectionSlugQuery } from '@cod/shared';
import { canonicalCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionPorts } from './collection-ports';

/** Whether a slug is free in the store (`StoreCollectionSlugAvailability`), in the form the store would keep. */
export interface SlugAvailabilityView {
  readonly slug: string;
  readonly available: boolean;
}

/**
 * "Is this slug free?" for the collection editor (D2319): another collection of the active store channel holding the
 * slug makes it taken; the edited collection's own slug is free. Another store's slugs never count.
 */
export class SlugAvailabilityService {
  constructor(private readonly ports: CollectionPorts) {}

  async check(ctx: OperationContext, query: StoreCollectionSlugQuery): Promise<SlugAvailabilityView> {
    // A malformed collection id names no collection, so nothing is excepted.
    const exceptId = query.collectionId === undefined ? undefined : canonicalCoreId(query.collectionId);
    const taken = await this.ports.vendure.slugTaken(ctx, query.slug, exceptId);
    return { slug: this.ports.vendure.storedSlugOf(query.slug), available: !taken };
  }
}
