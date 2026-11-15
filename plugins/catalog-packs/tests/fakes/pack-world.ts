import { toBusinessId, toStoreId } from '@cod/shared';
import type { PackPorts } from '../../application/pack-ports';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { FakeCatalogProducts } from './fake-catalog-products';
import { InlineTransaction } from './inline-transaction';
import { InMemoryPackRepository } from './in-memory-pack-repository';

/** Business A's first store. */
export const SCOPE_A: StoreScope = { businessId: toBusinessId('1001'), storeId: toStoreId('2001') };
/** Business B's first store. */
export const SCOPE_B: StoreScope = { businessId: toBusinessId('1002'), storeId: toStoreId('2002') };
/** A context the fakes never read. */
export const CTX = asOperationContext({});

/** The fakes of every pack port, wired as one bundle. */
export function packWorld(): { ports: PackPorts; packs: InMemoryPackRepository; catalog: FakeCatalogProducts } {
  const packs = new InMemoryPackRepository();
  const catalog = new FakeCatalogProducts();
  return { ports: { packs, catalog, transaction: new InlineTransaction() }, packs, catalog };
}
