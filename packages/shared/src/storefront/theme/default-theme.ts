import { defineSection, type Theme } from './schema';

const announcement = defineSection('announcement-bar', { messageKey: 'announcement.default' });
const header = defineSection('header');
const footer = defineSection('footer');

/**
 * The Arabic-first default theme (D3207). Page section orders follow the builder page templates of
 * `docs/research/second-pass.md`; reviews and FAQ sections are P8.
 */
export const DEFAULT_THEME: Theme = {
  version: 0,
  tokens: {
    colorPrimary: '#0f766e',
    colorText: '#1f2937',
    colorBackground: '#ffffff',
    radius: 'sm',
    font: 'plex-arabic',
  },
  pages: {
    home: [
      announcement,
      header,
      defineSection('hero-banner', { ctaKey: 'hero.cta' }),
      defineSection('product-grid', { limit: 8, columns: 4 }),
      defineSection('collections', { limit: 6 }),
      defineSection('image-with-text'),
      defineSection('trust-badges'),
      footer,
    ],
    product: [
      announcement,
      header,
      defineSection('gallery'),
      defineSection('product-info'),
      defineSection('in-page-checkout'),
      defineSection('description'),
      defineSection('product-grid', { limit: 4, columns: 4, related: true }),
      footer,
    ],
    collection: [announcement, header, defineSection('collection-header'), defineSection('product-grid'), footer],
    checkout: [announcement, header, defineSection('in-page-checkout'), defineSection('trust-badges'), footer],
    success: [announcement, header, defineSection('success-message'), footer],
    search: [announcement, header, defineSection('product-grid'), footer],
  },
};
