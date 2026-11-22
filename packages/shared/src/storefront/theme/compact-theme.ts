import { defineSection, type Theme } from './schema';

const header = defineSection('header');
const footer = defineSection('footer');

/**
 * A second valid theme with fewer sections, another order and other tokens. `STOREFRONT_THEME=compact` selects it to
 * prove a theme swap needs no code change (D3207).
 */
export const COMPACT_THEME: Theme = {
  version: 0,
  tokens: {
    colorPrimary: '#7c3aed',
    colorText: '#111827',
    colorBackground: '#fafafa',
    radius: 'lg',
    font: 'system',
  },
  pages: {
    home: [header, defineSection('product-grid', { limit: 12, columns: 2 }), footer],
    product: [
      header,
      defineSection('product-info'),
      defineSection('gallery'),
      defineSection('in-page-checkout'),
      footer,
    ],
    collection: [header, defineSection('product-grid', { columns: 2 }), footer],
    checkout: [header, defineSection('in-page-checkout'), footer],
    success: [defineSection('success-message'), footer],
    search: [header, defineSection('product-grid', { columns: 2 }), footer],
  },
};
