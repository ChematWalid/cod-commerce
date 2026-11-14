import type { CatalogProductDto, CatalogVariantDto } from '../../dashboard/dto';

const variant = (id: string, optionValues: readonly string[], index: number): CatalogVariantDto => ({
  id,
  name: `Runner - ${optionValues.join(' / ')}`,
  sku: `RUN-${String(index)}`,
  price: 2500,
  oldPrice: null,
  barcode: null,
  isHidden: false,
  optionValues,
  featuredAsset: null,
});

/** A saved product with Color (Red, Blue) × Size (S, M): four variants, `RUN-1` to `RUN-4`. */
export const savedRunner: CatalogProductDto = {
  id: '41',
  title: 'Runner',
  slug: 'runner',
  description: '<p>Light</p>',
  status: 'active',
  price: 2500,
  oldPrice: null,
  sku: 'RUN',
  barcode: null,
  weight: 300,
  width: null,
  height: null,
  length: null,
  featuredAsset: { id: '7' },
  assets: [{ id: '7' }],
  brandId: null,
  tagIds: ['7000000000000000002'],
  highlightIds: [],
  collectionIds: [],
  label: null,
  cardCaption: null,
  metaTitle: null,
  metaDescription: null,
  optionGroups: [
    {
      id: '1',
      name: 'Color',
      values: [
        { id: '11', name: 'Red' },
        { id: '12', name: 'Blue' },
      ],
    },
    {
      id: '2',
      name: 'Size',
      values: [
        { id: '21', name: 'S' },
        { id: '22', name: 'M' },
      ],
    },
  ],
  variants: [
    variant('101', ['Red', 'S'], 1),
    variant('102', ['Red', 'M'], 2),
    variant('103', ['Blue', 'S'], 3),
    variant('104', ['Blue', 'M'], 4),
  ],
  settings: {
    nameInDelivery: null,
    isFragile: false,
    allowParcelOpening: true,
    allowOutOfStockOrders: true,
    soldOut: false,
    quantityRules: { enabled: false, min: 1, step: 1 },
    orderManagerIds: [],
  },
};
