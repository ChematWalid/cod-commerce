import { randomBytes } from 'node:crypto';
import type { CatalogKit } from './catalog-kit';

/** A brand, a tag and a highlight of one store. */
export interface TaxonomyIds {
  readonly brandId: string;
  readonly tagId: string;
  readonly highlightId: string;
}

export const BRANDS = 'query { catalogBrands { id name } }';
export const TAGS = 'query { catalogTags { id name } }';
export const HIGHLIGHTS = 'query { catalogHighlights { id text } }';
export const CREATE_BRAND = 'mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id name } }';
export const CREATE_TAG = 'mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id name } }';
export const CREATE_HIGHLIGHT =
  'mutation ($input: CatalogHighlightInput!) { createCatalogHighlight(input: $input) { id text } }';

/** A brand, a tag and a highlight made through the API by the signed-in caller, in its active store. */
export async function createTaxonomy(kit: CatalogKit, label = randomBytes(3).toString('hex')): Promise<TaxonomyIds> {
  const brand = await kit.gql<{ createCatalogBrand: { id: string } }>(CREATE_BRAND, {
    input: { name: `Brand ${label}` },
  });
  const tag = await kit.gql<{ createCatalogTag: { id: string } }>(CREATE_TAG, { input: { name: `Tag ${label}` } });
  const highlight = await kit.gql<{ createCatalogHighlight: { id: string } }>(CREATE_HIGHLIGHT, {
    input: { text: `Highlight ${label}` },
  });
  return {
    brandId: brand.createCatalogBrand.id,
    tagId: tag.createCatalogTag.id,
    highlightId: highlight.createCatalogHighlight.id,
  };
}
