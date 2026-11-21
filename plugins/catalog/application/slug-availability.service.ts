import { Slug } from '../domain/slug';
import { parseCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductPorts } from './catalog-ports';

/** Whether a slug is free in the store, and the slug as the store would keep it. */
export interface SlugAvailability {
  readonly slug: string;
  readonly available: boolean;
}

/**
 * The business-scoped slug check of the editor (D2103, D500): a slug is unique per store channel, so it is checked in
 * the caller's active store only, and the product being edited (`productId`) does not count against itself. The slug
 * is normalised as Vendure stores it (NFD, lower case), so an NFC and an NFD Arabic slug are the same slug.
 */
export class SlugAvailabilityService {
  constructor(private readonly ports: Pick<ProductPorts, 'products'>) {}

  async check(ctx: OperationContext, rawSlug: string, productId: string | null): Promise<SlugAvailability> {
    const lookup = await this.ports.products.findBySlug(ctx, Slug.create(rawSlug).value);
    const self = productId === null ? undefined : parseCoreId(productId);
    const available = lookup.productId === undefined || lookup.productId === self;
    return { slug: lookup.slug, available };
  }
}
