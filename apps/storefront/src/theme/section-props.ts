import type { Section, StorefrontLocale, StorefrontStore } from '@cod/shared';
import type { ReactNode } from 'react';

/**
 * What a theme page renders from: data only, never the request (ADR 0006). The store comes from a verified tenant;
 * pages add their own data (products, collections) in later sessions.
 */
export interface ThemePageData {
  readonly locale: StorefrontLocale;
  readonly store: StorefrontStore;
  /** The year of the footer notice, from a cached clock: a render never reads the time itself. */
  readonly year: number;
}

/** The props every section component takes: its own section (id, type, settings) and the page data. */
export interface SectionProps {
  readonly section: Section;
  readonly data: ThemePageData;
}

/** A section component of the registry. */
export type SectionComponent = (props: SectionProps) => ReactNode;
