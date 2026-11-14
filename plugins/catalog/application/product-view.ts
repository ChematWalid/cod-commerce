import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../domain/core-id';
import { assertOrderManagers } from '../domain/order-managers';
import type { OperationContext } from '../domain/ports/operation-context';
import { priceWarningsOf } from '../domain/price-warnings';
import type { ProductRecord } from '../domain/product';
import {
  DEFAULT_PRODUCT_SETTINGS,
  type ProductSettingsChange,
  type ProductSettingsValues,
  settingsAfter,
  settingsValuesOf,
} from '../domain/product-settings';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import type { CheckedReferences } from './product-references';

/** A product with its links and settings in the store: what every read and save answers. */
export interface ProductView extends ProductRecord {
  readonly tagIds: readonly Snowflake[];
  readonly highlightIds: readonly Snowflake[];
  readonly collectionIds: readonly CoreId[];
  readonly settings: ProductSettingsValues;
}

/** A saved product and the warnings that did not stop the save (AC3: old price below price). */
export interface ProductSaveResult {
  readonly product: ProductView;
  readonly warnings: readonly string[];
}

/** Reads the links and settings of `record` in the scope's store. */
export async function viewOf(
  ports: ProductPorts,
  ctx: OperationContext,
  scope: StoreScope,
  record: ProductRecord,
): Promise<ProductView> {
  const [tagIds, highlightIds, collectionIds, settings] = await Promise.all([
    ports.tags.tagIdsOf(ctx, scope, record.id),
    ports.highlights.highlightIdsOf(ctx, scope, record.id),
    ports.collections.collectionIdsOf(ctx, scope, record.id),
    ports.settings.findByProduct(ctx, scope, record.id),
  ]);
  const values = settings === undefined ? DEFAULT_PRODUCT_SETTINGS : settingsValuesOf(settings);
  return { ...record, tagIds, highlightIds, collectionIds, settings: values };
}

/** The distinct warning codes of a product's prices: its own and every variant's. */
export function warningsOf(record: ProductRecord): readonly string[] {
  const prices = [{ price: record.price, oldPrice: record.oldPrice }, ...record.variants];
  return [...new Set(priceWarningsOf(prices).map((warning) => warning.code))];
}

/** What a save writes beside the product: links (each only when sent) and a settings change. */
export interface ProductLinks {
  readonly refs: CheckedReferences;
  readonly settings: ProductSettingsChange | undefined;
}

/**
 * Writes the tag, highlight and collection links that were sent, and the settings when sent or when the product has
 * none yet. Order managers are refused until the team check is registered (D2114, Task 12).
 */
/** The product a save writes links for, in its store. */
export interface ProductTarget {
  readonly scope: StoreScope;
  readonly productId: CoreId;
}

export async function saveLinks(
  ports: ProductPorts,
  ctx: OperationContext,
  { scope, productId }: ProductTarget,
  links: ProductLinks,
): Promise<void> {
  const { tagIds, highlightIds, collectionIds } = links.refs;
  if (tagIds !== undefined) await ports.tags.replaceProductTags(ctx, scope, productId, tagIds);
  if (highlightIds !== undefined) await ports.highlights.replaceProductHighlights(ctx, scope, productId, highlightIds);
  if (collectionIds !== undefined) {
    await ports.collections.replaceProductCollections(ctx, scope, productId, collectionIds);
  }
  await saveSettings(ports, ctx, { scope, productId }, links.settings);
}

async function saveSettings(
  ports: ProductPorts,
  ctx: OperationContext,
  { scope, productId }: ProductTarget,
  change: ProductSettingsChange | undefined,
): Promise<void> {
  const current = await ports.settings.findByProduct(ctx, scope, productId);
  if (change === undefined && current !== undefined) return;
  assertOrderManagers(change?.orderManagerIds ?? [], null);
  const identity = { id: ports.ids.next(), scope, productId, now: ports.clock.now() };
  await ports.settings.upsert(ctx, scope, settingsAfter(current, change ?? {}, identity));
}
