import type { BrandRepositoryPort } from '../domain/ports/brand-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { DescriptionSanitizerPort } from '../domain/ports/description-sanitizer.port';
import type { HighlightRepositoryPort } from '../domain/ports/highlight-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MediaLockPort } from '../domain/ports/media-lock.port';
import type { MediaRepositoryPort } from '../domain/ports/media-repository.port';
import type { MediaStoragePort } from '../domain/ports/media-storage.port';
import type { OrderManagerCheckSource } from '../domain/ports/order-manager-check.port';
import type { ProductCatalogPort } from '../domain/ports/product-catalog.port';
import type { ProductCollectionRepositoryPort } from '../domain/ports/product-collection-repository.port';
import type { ProductEventsPort } from '../domain/ports/product-events.port';
import type { ProductSearchPort } from '../domain/ports/product-search.port';
import type { ProductSettingsRepositoryPort } from '../domain/ports/product-settings-repository.port';
import type { SoldOutSource } from '../domain/ports/sold-out-source.port';
import type { StoreSettingsPort } from '../domain/ports/store-settings.port';
import type { TagRepositoryPort } from '../domain/ports/tag-repository.port';
import type { TaxonomyLockPort } from '../domain/ports/taxonomy-lock.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/**
 * Everything the product and taxonomy use cases reach the outside through; one bundle, wired once
 * (product.providers.ts).
 */
export interface ProductPorts {
  readonly products: ProductCatalogPort;
  readonly search: ProductSearchPort;
  readonly events: ProductEventsPort;
  readonly transaction: TransactionPort;
  readonly brands: BrandRepositoryPort;
  readonly tags: TagRepositoryPort;
  readonly highlights: HighlightRepositoryPort;
  readonly settings: ProductSettingsRepositoryPort;
  readonly media: MediaRepositoryPort;
  /** The files behind the media library (D2113). */
  readonly storage: MediaStoragePort;
  readonly collections: ProductCollectionRepositoryPort;
  readonly sanitizer: DescriptionSanitizerPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
  /** Keeps product saves and taxonomy deletes apart. */
  readonly taxonomyLock: TaxonomyLockPort;
  /** Keeps product saves and media deletes apart (D2128). */
  readonly mediaLock: MediaLockPort;
  /** Team's order-manager check, once registered (D2114). */
  readonly orderManagers: OrderManagerCheckSource;
  /** Which products are sold out: the manual flag until stock exists (D2107). */
  readonly soldOut: SoldOutSource;
  /** The caller's store and its sold-out behaviour, from tenancy (D2106, D2142). */
  readonly stores: StoreSettingsPort;
}
