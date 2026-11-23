import type { SectionType } from '@cod/shared';
import type { SectionComponent } from './section-props';
import { AnnouncementBar } from './sections/announcement-bar';
import { CollectionHeader } from './sections/collection-header';
import { Collections } from './sections/collections';
import { Description } from './sections/description';
import { Footer } from './sections/footer';
import { Gallery } from './sections/gallery';
import { Header } from './sections/header';
import { HeroBanner } from './sections/hero-banner';
import { ImageWithText } from './sections/image-with-text';
import { InPageCheckout } from './sections/in-page-checkout';
import { ProductGrid } from './sections/product-grid';
import { ProductInfo } from './sections/product-info';
import { SuccessMessage } from './sections/success-message';
import { TrustBadges } from './sections/trust-badges';

/** Which component renders each section type. */
export type SectionRegistry = Readonly<Partial<Record<SectionType, SectionComponent>>>;

/**
 * The storefront's section components. A new section is one entry here plus its type in the shared theme schema
 * (§3a.7); a type with no entry is skipped and logged by the renderer. Every type of the shared schema has one.
 */
export const SECTION_REGISTRY: SectionRegistry = {
  'announcement-bar': AnnouncementBar,
  header: Header,
  'hero-banner': HeroBanner,
  'product-grid': ProductGrid,
  collections: Collections,
  'image-with-text': ImageWithText,
  'trust-badges': TrustBadges,
  gallery: Gallery,
  'product-info': ProductInfo,
  'in-page-checkout': InPageCheckout,
  description: Description,
  'collection-header': CollectionHeader,
  'success-message': SuccessMessage,
  footer: Footer,
};
