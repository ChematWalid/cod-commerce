import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * P3.S1 (D3107, D3120, D3125): the store-scoped fee groups `delivery_fee_group` (one platform default per store, a
 * partial unique index), their wilaya rows `delivery_fee_rate` and their sparse commune rows
 * `delivery_fee_commune_rate`, both referencing their group by `(businessId, storeId, groupId)` with ON DELETE CASCADE.
 * No FK to `geo_town` (another plugin's table). Tables only: the store hook and the migrate converge seed the default.
 */
export class DeliveryPricing1795700000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "delivery_fee_group" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "name" character varying(80) NOT NULL, "carrierId" bigint, "chargeOverweight" boolean NOT NULL, "overweightAllowanceKg" integer NOT NULL, "overweightRate" integer NOT NULL, "isPlatformDefault" boolean NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "CHK_delivery_fee_group_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_5127913aa69c6057c4ff39f4524" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bdeb8d9abcddc2a87fc009ce99" ON "delivery_fee_group" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_13762e577d0dc378fd33eb2697" ON "delivery_fee_group" ("businessId", "storeId") WHERE "isPlatformDefault"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b3f702a77dd689ee1da304b56d" ON "delivery_fee_group" ("businessId", "storeId", "createdAt") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b28641b52a4604a06ee601a8d9" ON "delivery_fee_group" ("businessId", "storeId", "id") `, undefined);
        await queryRunner.query(`CREATE TABLE "delivery_fee_commune_rate" ("businessId" bigint NOT NULL, "storeId" bigint, "groupId" bigint NOT NULL, "codeOns" integer NOT NULL, "provinceCode" character varying(2) NOT NULL, "baseHome" integer, "baseDesk" integer, "overrideHome" integer, "overrideDesk" integer, "deliveryEnabled" boolean, "deskEnabled" boolean, CONSTRAINT "CHK_delivery_fee_commune_rate_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_3b4a02a5d2252b6aaf13b9b8f36" PRIMARY KEY ("groupId", "codeOns"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_22ee34a4293d76529cd2e2547e" ON "delivery_fee_commune_rate" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_948ab4a5b9eca7398a75ed6a41" ON "delivery_fee_commune_rate" ("businessId", "storeId", "groupId", "provinceCode") `, undefined);
        await queryRunner.query(`CREATE TABLE "delivery_fee_rate" ("businessId" bigint NOT NULL, "storeId" bigint, "groupId" bigint NOT NULL, "provinceCode" character varying(2) NOT NULL, "baseHome" integer NOT NULL, "baseDesk" integer NOT NULL, "overrideHome" integer, "overrideDesk" integer, "deliveryEnabled" boolean NOT NULL, "deskEnabled" boolean NOT NULL, CONSTRAINT "CHK_delivery_fee_rate_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_359b651b66ffa63100023bf6d9d" PRIMARY KEY ("groupId", "provinceCode"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_661c136542e2ae1b9959fe96ef" ON "delivery_fee_rate" ("businessId") `, undefined);
        await queryRunner.query(`ALTER TABLE "delivery_fee_commune_rate" ADD CONSTRAINT "FK_dc4c20594554ad8962ed094bd78" FOREIGN KEY ("businessId", "storeId", "groupId") REFERENCES "delivery_fee_group"("businessId","storeId","id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "delivery_fee_rate" ADD CONSTRAINT "FK_a2d39d29f3a1befc3d735c16a19" FOREIGN KEY ("businessId", "storeId", "groupId") REFERENCES "delivery_fee_group"("businessId","storeId","id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_fee_rate" DROP CONSTRAINT "FK_a2d39d29f3a1befc3d735c16a19"`, undefined);
        await queryRunner.query(`ALTER TABLE "delivery_fee_commune_rate" DROP CONSTRAINT "FK_dc4c20594554ad8962ed094bd78"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_661c136542e2ae1b9959fe96ef"`, undefined);
        await queryRunner.query(`DROP TABLE "delivery_fee_rate"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_948ab4a5b9eca7398a75ed6a41"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_22ee34a4293d76529cd2e2547e"`, undefined);
        await queryRunner.query(`DROP TABLE "delivery_fee_commune_rate"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b28641b52a4604a06ee601a8d9"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3f702a77dd689ee1da304b56d"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_13762e577d0dc378fd33eb2697"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdeb8d9abcddc2a87fc009ce99"`, undefined);
        await queryRunner.query(`DROP TABLE "delivery_fee_group"`, undefined);
   }

}
