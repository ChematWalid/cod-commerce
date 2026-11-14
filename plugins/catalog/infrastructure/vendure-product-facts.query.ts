import type { ProductStatus, Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Product, type RequestContext, TransactionalConnection } from '@vendure/core';
import type { CatalogVariantOption, FactsProductRow, FactsVariantRow } from '../application/product-facts';
import { type CoreId, toCoreId } from '../domain/core-id';
import { DEFAULT_PRODUCT_STATUS } from '../domain/constants';

/** A page of the store channel's product ids, newest first, after a keyset position (D2308). */
export interface FactsPageQuery {
  readonly after: CoreId | null;
  /** How many ids to read: the page size plus one, which tells whether another page follows. */
  readonly limit: number;
  readonly search: string | null;
}

/** A name in the context's language, else the first translation written (D2112), as `nameIn` picks it. */
const nameOf = (table: string, baseId: string): string =>
  `(SELECT t."name" FROM "${table}" t WHERE t."baseId" = ${baseId} ORDER BY (t."languageCode" = $2) DESC, t."id" LIMIT 1)`;

/** The live products of the channel `$1` among the ids `$3`. */
const PRODUCTS_SQL = `
SELECT p."id"::text AS "productId", COALESCE(${nameOf('product_translation', 'p."id"')}, '') AS "title",
  p."customFieldsStatus" AS "status", p."customFieldsBrandid" AS "brandId",
  p."customFieldsDefaultprice" AS "defaultPrice",
  (SELECT count(*) FROM "product_option_groups_product_option_group" pg
     JOIN "product_option_group" g ON g."id" = pg."productOptionGroupId" AND g."deletedAt" IS NULL
   WHERE pg."productId" = p."id")::int AS "optionGroupCount"
FROM "product" p
JOIN "product_channels_channel" pc ON pc."productId" = p."id" AND pc."channelId" = $1
WHERE p."id" = ANY($3::int[]) AND p."deletedAt" IS NULL
ORDER BY p."id" DESC`;

/** The live options of the variant `v` whose option and option group are live and the product's own, in order. */
const VARIANT_OPTIONS_SQL = `
COALESCE((SELECT json_agg(json_build_object('name', ${nameOf('product_option_group_translation', 'g."id"')},
    'value', ${nameOf('product_option_translation', 'o."id"')}) ORDER BY g."customFieldsPosition", g."id")
  FROM "product_variant_options_product_option" vo
  JOIN "product_option" o ON o."id" = vo."productOptionId" AND o."deletedAt" IS NULL
  JOIN "product_option_group" g ON g."id" = o."groupId" AND g."deletedAt" IS NULL
  JOIN "product_option_groups_product_option_group" pg
    ON pg."productOptionGroupId" = g."id" AND pg."productId" = v."productId"
  WHERE vo."productVariantId" = v."id"), '[]'::json)`;

/** The live variants, hidden ones included, of the products `$3`, with their price in channel `$1`, currency `$4`. */
const VARIANTS_SQL = `
SELECT v."productId"::text AS "productId", v."customFieldsIshidden" AS "hidden", pr."price" AS "price",
  v."customFieldsOldprice" AS "oldPrice", ${VARIANT_OPTIONS_SQL} AS "options"
FROM "product_variant" v
JOIN "product_variant_price" pr ON pr."variantId" = v."id" AND pr."channelId" = $1 AND pr."currencyCode" = $4
WHERE v."productId" = ANY($3::int[]) AND v."deletedAt" IS NULL
ORDER BY v."productId", v."id"`;

/**
 * One keyset page of the channel's live product ids, newest first (`id < $2`), never skip/take: a product deleted or
 * added between pages moves no other one. `$3` is a `LIKE` pattern on any translation of the title, or null.
 */
const PAGE_SQL = `
SELECT p."id"::text AS "id"
FROM "product" p
JOIN "product_channels_channel" pc ON pc."productId" = p."id" AND pc."channelId" = $1
WHERE p."deletedAt" IS NULL AND ($2::int IS NULL OR p."id" < $2::int)
  AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM "product_translation" t
    WHERE t."baseId" = p."id" AND t."name" ILIKE $3::text ESCAPE '\\'))
ORDER BY p."id" DESC
LIMIT $4`;

/** Every distinct option name and value of the channel's live products, in the order first created. */
const OPTIONS_SQL = `
SELECT n."name", n."value"
FROM "product" p
JOIN "product_channels_channel" pc ON pc."productId" = p."id" AND pc."channelId" = $1
JOIN "product_option_groups_product_option_group" pg ON pg."productId" = p."id"
JOIN "product_option_group" g ON g."id" = pg."productOptionGroupId" AND g."deletedAt" IS NULL
JOIN "product_option" o ON o."groupId" = g."id" AND o."deletedAt" IS NULL
CROSS JOIN LATERAL (SELECT ${nameOf('product_option_group_translation', 'g."id"')} AS "name",
  ${nameOf('product_option_translation', 'o."id"')} AS "value") n
WHERE p."deletedAt" IS NULL AND n."name" IS NOT NULL AND n."value" IS NOT NULL
GROUP BY n."name", n."value"
ORDER BY min(g."id"), min(o."id")`;

interface ProductRow {
  readonly productId: string;
  readonly title: string;
  readonly status: ProductStatus | null;
  readonly brandId: Snowflake | null;
  readonly defaultPrice: number | null;
  readonly optionGroupCount: number;
}

interface VariantRow {
  readonly productId: string;
  readonly hidden: boolean | null;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly options: readonly CatalogVariantOption[];
}

/** `%`, `_` and the escape itself match only themselves in a `LIKE` pattern. */
const likePattern = (text: string): string => `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

/**
 * The batched, read-only product facts reads (reviewed `RAW_DATA_ACCESS_FILES` entry, P2.S3 D2308): Vendure's product,
 * variant, price and option tables, which hold no tenant column, always joined to the context's channel and without
 * deleted rows. Vendure's services read one product at a time with every relation (N+1) and have no keyset page or
 * store-wide option list. Each method is one statement in the transaction `ctx` carries; the caller has checked that
 * the channel is its store's, and passes only parsed ids, so no input reaches Postgres unchecked.
 */
@Injectable()
export class VendureProductFactsQuery {
  constructor(private readonly connection: TransactionalConnection) {}

  /** The live products of the context's channel among `ids`, newest first. */
  async products(ctx: RequestContext, ids: readonly CoreId[]): Promise<readonly FactsProductRow[]> {
    const rows = await this.run<ProductRow>(ctx, PRODUCTS_SQL, [this.language(ctx), [...ids]]);
    return rows.map((row) => ({
      ...row,
      productId: toCoreId(row.productId),
      status: row.status ?? DEFAULT_PRODUCT_STATUS,
    }));
  }

  /** Every live variant of `ids`, hidden ones included, with its price in the context's channel. */
  async variants(ctx: RequestContext, ids: readonly CoreId[]): Promise<readonly FactsVariantRow[]> {
    const parameters = [this.language(ctx), [...ids], ctx.channel.defaultCurrencyCode];
    const rows = await this.run<VariantRow>(ctx, VARIANTS_SQL, parameters);
    return rows.map((row) => ({ ...row, productId: toCoreId(row.productId), hidden: row.hidden ?? false }));
  }

  /** At most `limit` live product ids of the context's channel below `after`, newest first. */
  async pageIds(ctx: RequestContext, { after, limit, search }: FactsPageQuery): Promise<readonly CoreId[]> {
    const pattern = search === null ? null : likePattern(search);
    const rows = await this.run<{ id: string }>(ctx, PAGE_SQL, [after, pattern, limit]);
    return rows.map((row) => toCoreId(row.id));
  }

  /** Every distinct option name and value of the context's channel. */
  options(ctx: RequestContext): Promise<readonly CatalogVariantOption[]> {
    return this.run<CatalogVariantOption>(ctx, OPTIONS_SQL, [this.language(ctx)]);
  }

  private language(ctx: RequestContext): string {
    return ctx.channel.defaultLanguageCode;
  }

  private run<T>(ctx: RequestContext, sql: string, parameters: readonly unknown[]): Promise<T[]> {
    const repository = this.connection.getRepository(ctx, Product);
    return repository.query<T[]>(sql, [ctx.channelId, ...parameters]);
  }
}
