import type { SectionType } from '@cod/shared';
import type { SectionComponent } from './section-props';
import { AnnouncementBar } from './sections/announcement-bar';
import { Footer } from './sections/footer';
import { Header } from './sections/header';
import { HeroBanner } from './sections/hero-banner';
import { ImageWithText } from './sections/image-with-text';
import { SuccessMessage } from './sections/success-message';
import { TrustBadges } from './sections/trust-badges';

/** Which component renders each section type. */
export type SectionRegistry = Readonly<Partial<Record<SectionType, SectionComponent>>>;

/**
 * The storefront's section components. A new section is one entry here plus its type in the shared theme schema
 * (§3a.7); a type with no entry yet (catalog sections arrive with the pages) is skipped and logged by the renderer.
 */
export const SECTION_REGISTRY: SectionRegistry = {
  'announcement-bar': AnnouncementBar,
  header: Header,
  'hero-banner': HeroBanner,
  'image-with-text': ImageWithText,
  'trust-badges': TrustBadges,
  'success-message': SuccessMessage,
  footer: Footer,
};
