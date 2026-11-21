import type { CatalogImportWorld } from '../isolation/catalog-import-world';
import type { CatalogWorld } from '../isolation/catalog-world';
import type { CollectionsWorld } from '../isolation/collections-world';
import { type OffersWorld, SHARED_CODE } from '../isolation/offers-rows';
import type { BusinessWorld } from '../isolation/world-types';

// The made-up businesses of the P2 isolation matrix unit test, one builder per plugin's rows. Requests are built from
// them, never sent; each row still gets its own id prefix so a fingerprint names one row only.

const store = (label: string, id: string) => ({
  label,
  id,
  subdomain: `store-${id}`,
  channelToken: `token-${id}`,
});

/** A business of the matrix with made-up ids: requests are built, never sent. */
export function businessOf(label: 'A' | 'B'): BusinessWorld {
  const n = label === 'A' ? '1' : '2';
  return {
    label,
    businessId: `10000000000000000${n}`,
    name: `Business ${label}`,
    stores: [store(`${label}1`, `20000000000000000${n}`), store(`${label}2`, `30000000000000000${n}`)],
    owner: { label: `owner ${label}`, token: 'owner', email: 'o@example.test', administratorId: n, lastName: 'L' },
    member: { label: `member ${label}`, token: 'member', email: 'm@example.test', administratorId: `1${n}` },
    role: { id: `40000000000000000${n}`, name: `Role ${label}` },
    secret: { id: `50000000000000000${n}`, value: 'synthetic' },
    note: { id: `60000000000000000${n}`, title: `Note ${label}` },
    logoAssetId: `T_${n}`,
  };
}

/** The catalog rows of a business of the matrix, with made-up ids. */
export function catalogOf(label: 'A' | 'B'): CatalogWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}0000000000000000${n}`;
  return {
    brand: { id: id('7'), name: `Brand ${label}` },
    tag: { id: id('8'), name: `Tag ${label}` },
    highlight: { id: id('9'), text: `Highlight ${label}` },
    collection: { id: `T_1${n}`, name: `Collection ${label}`, slug: `collection-${label}` },
    media: { id: id('11'), assetId: `T_2${n}` },
    otherStoreMedia: { id: id('12'), assetId: `T_3${n}` },
    product: {
      id: `T_4${n}`,
      restId: `4${n}`,
      title: `Product ${label}`,
      slug: `iso-${label}`,
      sku: `ISO-${label}`,
      variantIds: [`T_5${n}`, `T_6${n}`],
    },
    catalogRole: { id: id('13'), name: `Catalog role ${label}` },
  };
}

/** The collections rows of a business of the matrix, with made-up ids (P2.S3). */
export function collectionsOf(label: 'A' | 'B'): CollectionsWorld {
  const n = label === 'A' ? '1' : '2';
  const collection = (prefix: string) => ({ id: `T_${prefix}${n}`, title: `Collection ${prefix} ${label}` });
  return {
    automatic: collection('7'),
    otherStore: collection('9'),
    secondProduct: { id: `T_10${n}`, title: `Second product ${label}` },
  };
}

/** The offers rows of a business of the matrix, with made-up ids. */
export function offersOf(label: 'A' | 'B'): OffersWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}0000000000000000${n}`;
  return {
    automaticOfferId: id('17'),
    codeOfferId: id('18'),
    code: `ISO-${label}-${id('1')}`,
    sharedCodeOfferId: id('19'),
    sharedCode: SHARED_CODE,
    variantId: `5${n}`,
    offersRole: { id: id('20'), name: `Offers role ${label}` },
  };
}

/** The packs, import and export rows of a business of the matrix, with made-up ids. */
export function catalogImportOf(label: 'A' | 'B'): CatalogImportWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}0000000000000000${n}`;
  return {
    pack: { productId: `T_7${n}`, componentIds: [`T_8${n}`, `T_9${n}`] },
    spreadsheet: { importId: id('21'), uploadKey: `uploads/b/${id('1')}/s/${id('2')}/imports/${id('21')}/source` },
    exportId: id('22'),
    link: { importId: id('23'), productId: `T_10${n}` },
  };
}
