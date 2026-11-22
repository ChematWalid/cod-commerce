import {
  type StorefrontCollection,
  type StorefrontProduct,
  type StorefrontProductCard,
  type StorefrontStore,
  storefrontStoreSchema,
} from '@cod/shared';
import type { VerifiedTenant } from '../../src/tenancy/verified-tenant';

/** A synthetic active store; `overrides` changes single fields. */
export function storeFixture(overrides: Partial<StorefrontStore> = {}): StorefrontStore {
  return storefrontStoreSchema.parse({
    storeId: '1001',
    businessId: '1',
    name: 'Demo Store',
    description: 'Everything for the home',
    logoPath: null,
    language: 'ar',
    direction: 'rtl',
    primaryHost: 'demo.localhost',
    showAddressField: true,
    soldOutBehavior: 'keep',
    status: 'active',
    ...overrides,
  });
}

/** A verified tenant for loader and section tests; production code only gets one from the verifier. */
export function tenantFixture(store: StorefrontStore = storeFixture()): VerifiedTenant {
  return { storeId: store.storeId, locale: store.language, store } as unknown as VerifiedTenant;
}

export function cardFixture(overrides: Partial<StorefrontProductCard> = {}): StorefrontProductCard {
  return {
    id: '5001',
    slug: 'kettle',
    name: 'Steel Kettle',
    price: 3500,
    oldPrice: null,
    imagePath: 'b/1/s/1001/preview/kettle.jpg',
    soldOut: false,
    ...overrides,
  };
}

export function collectionFixture(overrides: Partial<StorefrontCollection> = {}): StorefrontCollection {
  return {
    id: '7001',
    slug: 'kitchen',
    title: 'Kitchen',
    description: 'Pots and pans',
    imagePath: 'http://api.internal:3000/assets/b/1/s/1001/preview/kitchen.jpg',
    ...overrides,
  };
}

/** A product with two colours: red (in stock, 2500 DA) and blue (sold out, 2700 DA, its own image). */
export function productFixture(overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    id: '5002',
    slug: 'scarf',
    name: 'Wool Scarf',
    description: 'Warm and soft',
    images: [{ path: 'b/1/s/1001/preview/scarf.jpg', alt: 'Wool Scarf' }],
    optionGroups: [
      {
        code: 'color',
        name: 'Colour',
        options: [
          { code: 'red', name: 'Red' },
          { code: 'blue', name: 'Blue' },
        ],
      },
    ],
    variants: [
      {
        id: '6001',
        sku: 'SC-R',
        price: 2500,
        oldPrice: 3000,
        optionCodes: ['red'],
        imagePath: null,
        soldOut: false,
      },
      {
        id: '6002',
        sku: 'SC-B',
        price: 2700,
        oldPrice: null,
        optionCodes: ['blue'],
        imagePath: 'b/1/s/1001/preview/scarf-blue.jpg',
        soldOut: true,
      },
    ],
    metaTitle: '',
    metaDescription: '',
    ...overrides,
  };
}
