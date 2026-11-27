import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `cod_normalize_for_search(text)`: `normalizeForSearch` of `@cod/shared` in SQL (ADR 0014), step by step: NFKC, lower
 * case (the builtin `pg_c_utf8` collation, the same answer on every host), the alef, alef maqsura, taa marbuta, sharp s
 * and dotted i folds, Arabic marks, tatweel and every Unicode `Cf` range removed (`SEARCH_FORMAT_CHARACTER_RANGES`),
 * JavaScript's `\s` collapsed and trimmed, NFKC again, the hamza seats and Arabic-Indic digits, the Latin letters with
 * no decomposition, and Latin combining marks dropped after NFD. Every step is IMMUTABLE, so the function is too (D3220);
 * `SEARCH_NORMAL_CASES` proves it equal to the TypeScript one.
 */
const COD_NORMALIZE_FOR_SEARCH_SQL = String.raw`CREATE FUNCTION "cod_normalize_for_search"(input text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN normalize(regexp_replace(normalize(
    replace(replace(replace(translate(
      translate(normalize(btrim(regexp_replace(regexp_replace(
        replace(replace(translate(lower(normalize(input, NFKC) COLLATE "pg_c_utf8"), 'أإآٱىة', 'اااايه'), 'ß', 'ss'), U&'i\0307', 'i'),
        '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0640\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]',
        '', 'g'),
        '[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+', ' ', 'g'), ' '), NFKC),
      'ؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'وي01234567890123456789'),
      'øłıđðħ', 'oliddh'), 'œ', 'oe'), 'æ', 'ae'), 'þ', 'th'),
    NFD), '[\u0300-\u036F]', '', 'g'), NFC)`;

/**
 * The storefront search (P3.S2 Task 6c, ADR 0014 Phase 1): the SQL normaliser, a trigram index over each store's
 * `searchText` (`btree_gin` puts the store first, so a search never reads another store's postings), and the per-business
 * Darija synonym table, seeded on a business's first search.
 */
export class StorefrontSearch1795600000001 implements MigrationInterface {
  name = 'StorefrontSearch1795600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(COD_NORMALIZE_FOR_SEARCH_SQL, undefined);
    await queryRunner.query(
      `CREATE INDEX "storefront_product_search" ON "storefront_product" USING gin ("storeId", "searchText" gin_trgm_ops)`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "storefront_search_synonym" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "term" character varying(100) NOT NULL, "expansion" character varying(100) NOT NULL, CONSTRAINT "PK_93825b0029a76fa7b7bf41c7241" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_730733574b0a48022b2056cc7c" ON "storefront_search_synonym" ("businessId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "storefront_search_synonym_pair" ON "storefront_search_synonym" ("businessId", "term", "expansion") `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."storefront_search_synonym_pair"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_730733574b0a48022b2056cc7c"`, undefined);
    await queryRunner.query(`DROP TABLE "storefront_search_synonym"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."storefront_product_search"`, undefined);
    await queryRunner.query(`DROP FUNCTION "cod_normalize_for_search"(text)`, undefined);
  }
}
