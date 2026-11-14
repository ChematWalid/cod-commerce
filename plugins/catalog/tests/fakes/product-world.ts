import type { ProductChangeKind, TenantScope } from '@cod/shared';
import type { ProductPorts } from '../../application/catalog-ports';
import { OrderManagerCheckRegistry } from '../../application/order-manager-check.registry';
import type { CoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { newId, T0 } from '../support/builders';
import { InMemoryBrandRepository } from './in-memory-brand-repository';
import { InMemoryHighlightRepository } from './in-memory-highlight-repository';
import { InMemoryMediaRepository } from './in-memory-media-repository';
import { InMemoryProductCatalog, storeContext } from './in-memory-product-catalog';
import { InMemoryProductCollectionRepository } from './in-memory-product-collection-repository';
import { InMemoryProductSettingsRepository } from './in-memory-product-settings-repository';
import { InMemoryTagRepository } from './in-memory-tag-repository';

/** One `product.changed` event a use case published. */
export interface PublishedEvent {
  readonly scope: StoreScope;
  readonly productId: CoreId;
  readonly change: ProductChangeKind;
}

/** Every fake behind the product use cases, the events they publish, and a context per store. */
export class ProductWorld {
  readonly products = new InMemoryProductCatalog();
  readonly brands = new InMemoryBrandRepository();
  readonly tags = new InMemoryTagRepository();
  readonly highlights = new InMemoryHighlightRepository();
  readonly settings = new InMemoryProductSettingsRepository();
  readonly media = new InMemoryMediaRepository();
  readonly collections = new InMemoryProductCollectionRepository();
  /** Where a test registers a fake team check (D2114); empty by default, like a server without team. */
  readonly orderManagerChecks = new OrderManagerCheckRegistry();
  readonly events: PublishedEvent[] = [];
  /** Product ids the fake search answers with, whatever the text. */
  searchHits: CoreId[] = [];
  /** Transactions run, so a test can tell a write ran inside one. */
  transactions = 0;

  readonly ports: ProductPorts = {
    products: this.products,
    search: { matchingProductIds: () => Promise.resolve(this.searchHits) },
    events: {
      publish: (_ctx, scope, productId, change) => {
        this.events.push({ scope, productId, change });
        return Promise.resolve();
      },
    },
    transaction: {
      run: <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>) => {
        this.transactions += 1;
        return work(ctx);
      },
    },
    brands: this.brands,
    tags: this.tags,
    highlights: this.highlights,
    settings: this.settings,
    media: this.media,
    collections: this.collections,
    // Marks the text so a test sees the sanitiser ran; the real allow-list is tested on its own.
    sanitizer: { sanitize: (html) => html.replaceAll(/<script>.*?<\/script>/g, '') },
    ids: { next: newId },
    clock: { now: () => T0 },
    orderManagers: this.orderManagerChecks,
  };

  /** The context of a call made in `scope`'s store channel. */
  ctxOf(scope: StoreScope): OperationContext {
    return storeContext(scope.storeId);
  }
}
