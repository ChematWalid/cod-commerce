import type { MigrationInterface, QueryRunner } from "typeorm";

export class CatalogImport1795210000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "catalog_export_job" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "status" character varying(32) NOT NULL, "format" character varying(32) NOT NULL, "scope" character varying(32) NOT NULL, "query" jsonb, "fields" jsonb, "rowCount" integer NOT NULL DEFAULT '0', "progress" integer NOT NULL DEFAULT '0', "skippedPacks" integer NOT NULL DEFAULT '0', "actorAdministratorId" integer, "errorCode" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "finishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e9bf7101ca351dbe93f89c1a24d" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ccbaad0898e6902a332232e89f" ON "catalog_export_job" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6e5631c3cc4692c054746a4c8b" ON "catalog_export_job" ("status", "updatedAt") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_72f01c4823d4f64af1abc88a6f" ON "catalog_export_job" ("businessId", "storeId", "createdAt") `, undefined);
        await queryRunner.query(`CREATE TABLE "catalog_import_job" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "kind" character varying(32) NOT NULL, "status" character varying(32) NOT NULL, "format" character varying(32), "declaredSize" integer, "declaredContentType" character varying(128), "etag" character varying(128), "headerRow" integer, "mapping" jsonb, "mappingHash" character varying(64), "rowCount" integer NOT NULL DEFAULT '0', "progress" integer NOT NULL DEFAULT '0', "summary" jsonb, "sourceUrl" character varying(2048), "productId" integer, "actorAdministratorId" integer, "errorCode" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "finishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_da3d33fd0b2a0f6033c8aed4957" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_dee9162b7e7a8fe119f48a8243" ON "catalog_import_job" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_aa499d274378d9c818a3663f65" ON "catalog_import_job" ("status", "updatedAt") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ec5cb9a42bb4fadd406bdbb0b3" ON "catalog_import_job" ("businessId", "storeId", "createdAt") `, undefined);
        await queryRunner.query(`CREATE TABLE "catalog_import_row" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "jobId" bigint NOT NULL, "rowNumber" integer NOT NULL, "action" character varying(32) NOT NULL, "data" jsonb NOT NULL, "reasons" jsonb NOT NULL DEFAULT '[]', "productId" integer, "applied" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_27809f89650b2ffa7ee13622fdc" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_67736c6da9f7fa926bd229b9d0" ON "catalog_import_row" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_44314b81a91f6cb936d1a88442" ON "catalog_import_row" ("businessId", "jobId", "rowNumber") `, undefined);
        await queryRunner.query(`CREATE TABLE "catalog_product_origin" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "productId" integer NOT NULL, "source" character varying(32) NOT NULL, "importJobId" bigint, "needsImageReview" boolean NOT NULL DEFAULT false, "imageUrls" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3ef87a255bb49b6fba2a636d94c" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4c23e6da926b23b25670eaee0d" ON "catalog_product_origin" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c64ce8bf1a8bada3e515356f6f" ON "catalog_product_origin" ("businessId", "storeId", "productId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c64ce8bf1a8bada3e515356f6f"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c23e6da926b23b25670eaee0d"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_product_origin"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_44314b81a91f6cb936d1a88442"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_67736c6da9f7fa926bd229b9d0"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_import_row"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec5cb9a42bb4fadd406bdbb0b3"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa499d274378d9c818a3663f65"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_dee9162b7e7a8fe119f48a8243"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_import_job"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_72f01c4823d4f64af1abc88a6f"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_6e5631c3cc4692c054746a4c8b"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccbaad0898e6902a332232e89f"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_export_job"`, undefined);
   }

}
