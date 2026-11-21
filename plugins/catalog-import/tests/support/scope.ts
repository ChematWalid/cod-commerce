import { toBusinessId, toStoreId } from '@cod/shared';
import type { StoreScope } from '../../domain/store-scope';

/** A synthetic business and store of the unit tests. */
export const SCOPE: StoreScope = { businessId: toBusinessId('11'), storeId: toStoreId('22') };

/** Another business and store. */
export const OTHER_SCOPE: StoreScope = { businessId: toBusinessId('33'), storeId: toStoreId('44') };

/** Bytes of a text. */
export const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);
