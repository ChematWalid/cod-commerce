import type { MigrationInterface, QueryRunner } from "typeorm";

export class CatalogPacks1795200000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "catalog_pack" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "productId" integer NOT NULL, "status" character varying(16) NOT NULL, "pricingMode" character varying(16) NOT NULL, "fixedPrice" integer, "discountType" character varying(16), "discountValue" integer, "variantMode" character varying(16) NOT NULL, "sharedOption" character varying(50), "weightMode" character varying(16) NOT NULL, "fixedWeightGrams" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_c061d383a505a76fe9299e98a3e" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ecf39699693bdb1820daa863df" ON "catalog_pack" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cb0c72c541d74c0829419bbe1a" ON "catalog_pack" ("businessId", "storeId", "productId") `, undefined);
        await queryRunner.query(`CREATE TABLE "catalog_pack_component" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "packId" bigint NOT NULL, "position" integer NOT NULL, "productId" integer NOT NULL, "variantId" integer, "quantity" integer NOT NULL, CONSTRAINT "PK_aa3ee12f5a4426aa3c3436822e2" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_eb770e6472e70fbbf6a67f236d" ON "catalog_pack_component" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4c8f2b06038ccc334b3fa378fd" ON "catalog_pack_component" ("businessId", "packId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_704ad78ecb919e5664cf515ff5" ON "catalog_pack_component" ("businessId", "storeId", "productId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_704ad78ecb919e5664cf515ff5"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c8f2b06038ccc334b3fa378fd"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb770e6472e70fbbf6a67f236d"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_pack_component"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb0c72c541d74c0829419bbe1a"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecf39699693bdb1820daa863df"`, undefined);
        await queryRunner.query(`DROP TABLE "catalog_pack"`, undefined);
   }

}
