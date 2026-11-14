import type { ProductChangeKind, SoldOutBehavior, TenantScope } from '@cod/shared';
import type { ProductPorts } from '../../application/catalog-ports';
import { OrderManagerCheckRegistry } from '../../application/order-manager-check.registry';
import type { CoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { ActiveStore } from '../../domain/ports/store-settings.port';
import { SettingsFlagSoldOutSource } from '../../infrastructure/settings-flag-sold-out.source';
import type { StoreScope } from '../../domain/store-scope';
import { newId, T0 } from '../support/builders';
import { InMemoryBrandRepository } from './in-memory-brand-repository';
import { InMemoryHighlightRepository } from './in-memory-highlight-repository';
import { InMemoryMediaRepository } from './in-memory-media-repository';
import { InMemoryMediaStorage } from './in-memory-media-storage';
import { InMemoryProductCatalog, storeContext } from './in-memory-product-catalog';

/** The store a fake context stands for (see `storeContext`). */
const storeOf = (ctx: OperationContext): string => (ctx as unknown as { storeId: string }).storeId;
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
  readonly storage = new InMemoryMediaStorage();
  readonly collections = new InMemoryProductCollectionRepository();
  /** Where a test registers a fake team check (D2114); empty by default, like a server without team. */
  readonly orderManagerChecks = new OrderManagerCheckRegistry();
  readonly events: PublishedEvent[] = [];
  /** The store each store context resolves to for public reads (D2142); none until {@link openStore}. */
  private readonly activeStores = new Map<string, ActiveStore>();
  /** Product ids the fake search answers with, whatever the text. */
  searchHits: CoreId[] = [];
  /** Transactions run, so a test can tell a write ran inside one. */
  transactions = 0;
  /** Taxonomy and media locks taken outside a transaction, where they would end at once. */
  locksOutsideTransaction = 0;
  private openTransactions = 0;

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
      run: async <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>) => {
        this.transactions += 1;
        this.openTransactions += 1;
        try {
          return await work(ctx);
        } finally {
          this.openTransactions -= 1;
        }
      },
    },
    brands: this.brands,
    tags: this.tags,
    highlights: this.highlights,
    settings: this.settings,
    media: this.media,
    storage: this.storage,
    collections: this.collections,
    // Marks the text so a test sees the sanitiser ran; the real allow-list is tested on its own.
    sanitizer: { sanitize: (html) => html.replaceAll(/<script>.*?<\/script>/g, '') },
    ids: { next: newId },
    clock: { now: () => T0 },
    taxonomyLock: {
      // Logged with the product calls, so a test sees which lock came first; an empty share takes nothing.
      share: (_ctx, ids) => {
        if (ids.length > 0) this.lockCall(`share:${[...ids].sort().join(',')}`);
        return Promise.resolve();
      },
      exclusive: (_ctx, id) => {
        this.lockCall(`exclusive:${id}`);
        return Promise.resolve();
      },
    },
    mediaLock: {
      share: (_ctx, ids) => {
        if (ids.length > 0) this.lockCall(`media-share:${[...new Set(ids)].sort().join(',')}`);
        return Promise.resolve();
      },
      exclusive: (_ctx, id) => {
        this.lockCall(`media-exclusive:${id}`);
        return Promise.resolve();
      },
    },
    orderManagers: this.orderManagerChecks,
    soldOut: new SettingsFlagSoldOutSource(this.settings),
    stores: {
      activeStoreOf: (ctx) => Promise.resolve(this.activeStores.get(storeOf(ctx))),
    },
  };

  /** Makes `scope`'s store the active store of its contexts, with `soldOutBehavior`, as tenancy would. */
  openStore(scope: StoreScope, soldOutBehavior: SoldOutBehavior): void {
    this.activeStores.set(scope.storeId, { scope, soldOutBehavior });
  }

  private lockCall(call: string): void {
    if (this.openTransactions === 0) this.locksOutsideTransaction += 1;
    this.products.calls.push(call);
  }

  /** The context of a call made in `scope`'s store channel. */
  ctxOf(scope: StoreScope): OperationContext {
    return storeContext(scope.storeId);
  }
}
