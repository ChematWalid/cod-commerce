import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The storefront projection (P3.S2, D3205) and the Postgres extensions ADR 0014 search builds on. `pg_trgm`,
 * `unaccent` and `btree_gin` are trusted contrib extensions, so the database owner creates them; `down` keeps them,
 * since later migrations (the search normaliser and its indexes) depend on them.
 */
export class StorefrontApi1795600000000 implements MigrationInterface {
  name = 'StorefrontApi1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`, undefined);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`, undefined);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gin`, undefined);
    await queryRunner.query(
      `CREATE TABLE "storefront_product" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "productId" integer NOT NULL, "slug" character varying(255) NOT NULL, "name" text NOT NULL, "searchText" text NOT NULL, "price" integer NOT NULL, "oldPrice" integer, "imagePath" text, "visible" boolean NOT NULL, "soldOut" boolean NOT NULL, "listed" boolean NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "storefront_product_store_required" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_8568fe65caba4e826374e760145" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(`CREATE INDEX "IDX_56d4d62c8fe921078752e04548" ON "storefront_product" ("businessId") `, undefined);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "storefront_product_store_product" ON "storefront_product" ("businessId", "storeId", "productId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "storefront_product_store_slug" ON "storefront_product" ("businessId", "storeId", "slug") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "storefront_product_listed_newest" ON "storefront_product" ("businessId", "storeId", "listed", "createdAt", "productId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "storefront_product_listed_price" ON "storefront_product" ("businessId", "storeId", "listed", "price", "productId") `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."storefront_product_listed_price"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."storefront_product_listed_newest"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."storefront_product_store_slug"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."storefront_product_store_product"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_56d4d62c8fe921078752e04548"`, undefined);
    await queryRunner.query(`DROP TABLE "storefront_product"`, undefined);
  }
}
