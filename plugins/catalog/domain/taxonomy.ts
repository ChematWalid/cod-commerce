import { BRAND_NAME_MAX, type BusinessId, type Snowflake, type StoreId, TAG_NAME_MAX } from '@cod/shared';
import { comparableText } from './comparable-text';
import { singleLineText } from './single-line-text';
import type { StoreScope } from './store-scope';

/** A brand or a tag of one store: a name unique in that store whatever its case or Unicode form (D2140). */
export interface CatalogNameEntry {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly name: string;
  /** The name as the unique index compares it, see {@link nameKeyOf}. */
  readonly nameKey: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A brand a product may name (one per product). */
export type Brand = CatalogNameEntry;
/** A tag products may carry (many per product). */
export type Tag = CatalogNameEntry;

/** What a new brand or tag is made from. */
export interface NewCatalogName {
  readonly id: Snowflake;
  readonly scope: StoreScope;
  readonly name: string;
  readonly now: Date;
}

/** The stored key of a brand or tag name: trimmed, NFC, lower case; "Café", " CAFÉ" and an NFD "café" share it. */
export const nameKeyOf = (name: string): string => comparableText(name);

function entryOf({ id, scope, name, now }: NewCatalogName, max: number): CatalogNameEntry {
  const value = singleLineText(name, max);
  const { businessId, storeId } = scope;
  return { id, businessId, storeId, name: value, nameKey: nameKeyOf(value), createdAt: now, updatedAt: now };
}

function renamed(entry: CatalogNameEntry, name: string, now: Date, max: number): CatalogNameEntry {
  const value = singleLineText(name, max);
  return { ...entry, name: value, nameKey: nameKeyOf(value), updatedAt: now };
}

/**
 * A new brand of the scope's store.
 *
 * @throws {InvalidCatalogInputError} when the name is blank, longer than `BRAND_NAME_MAX` or not one plain line.
 */
export const createBrand = (input: NewCatalogName): Brand => entryOf(input, BRAND_NAME_MAX);

/**
 * A new tag of the scope's store.
 *
 * @throws {InvalidCatalogInputError} when the name is blank, longer than `TAG_NAME_MAX` or not one plain line.
 */
export const createTag = (input: NewCatalogName): Tag => entryOf(input, TAG_NAME_MAX);

/** `brand` under a new name; same rules as {@link createBrand}. */
export const renameBrand = (brand: Brand, name: string, now: Date): Brand => renamed(brand, name, now, BRAND_NAME_MAX);

/** `tag` under a new name; same rules as {@link createTag}. */
export const renameTag = (tag: Tag, name: string, now: Date): Tag => renamed(tag, name, now, TAG_NAME_MAX);
