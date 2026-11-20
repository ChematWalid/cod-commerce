import type { MigrationInterface, QueryRunner } from "typeorm";

export class Offers1795400000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "offers_offer" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "kind" character varying(64) NOT NULL, "method" character varying(16) NOT NULL, "title" character varying(120) NOT NULL, "label" jsonb NOT NULL, "config" jsonb NOT NULL, "combinesWith" jsonb NOT NULL, "eligibility" jsonb NOT NULL, "totalUsageLimit" integer, "perBuyerLimit" integer, "status" character varying(16) NOT NULL, "startsAt" TIMESTAMP WITH TIME ZONE, "endsAt" TIMESTAMP WITH TIME ZONE, "publishedAt" TIMESTAMP WITH TIME ZONE, "pausedAt" TIMESTAMP WITH TIME ZONE, "archivedAt" TIMESTAMP WITH TIME ZONE, "usageCount" integer NOT NULL DEFAULT '0', "version" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "CHK_offers_offer_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_d611e618dbf3754ffb7fc1ffb38" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d9e3592997d9f464bca83f0464" ON "offers_offer" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_98684a8236a447aa5409e08522" ON "offers_offer" ("businessId", "storeId", "status") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7a3ff24f5b3cd6499bcf21594e" ON "offers_offer" ("businessId", "storeId", "id") `, undefined);
        await queryRunner.query(`CREATE TABLE "offers_code" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "offerId" bigint NOT NULL, "code" character varying(32) NOT NULL, "usageLimit" integer, "usageCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "CHK_offers_code_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_4c4f37aa9199e3b30c0a035c3a2" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_cd1dcd859014c798a60c69f1aa" ON "offers_code" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ef86ff4fbe61730ea30b9d2bba" ON "offers_code" ("businessId", "storeId", "offerId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4c7b5add147e90d45820031358" ON "offers_code" ("businessId", "storeId", "code") `, undefined);
        await queryRunner.query(`CREATE TABLE "offers_offer_target" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "offerId" bigint NOT NULL, "role" character varying(16) NOT NULL, "refType" character varying(16) NOT NULL, "refId" integer NOT NULL, "position" integer NOT NULL, CONSTRAINT "CHK_offers_offer_target_role" CHECK ("role" IN ('buy')), CONSTRAINT "CHK_offers_offer_target_ref_type" CHECK ("refType" IN ('variant', 'product', 'collection')), CONSTRAINT "CHK_offers_offer_target_store" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_08935d004642d1d8421ad1d4603" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_880cdb58e970ae52d42a527086" ON "offers_offer_target" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_fd36c73d8b90d3f1fdd21e461a" ON "offers_offer_target" ("businessId", "storeId", "offerId", "position") `, undefined);
        await queryRunner.query(`ALTER TABLE "offers_code" ADD CONSTRAINT "FK_ef86ff4fbe61730ea30b9d2bba4" FOREIGN KEY ("businessId", "storeId", "offerId") REFERENCES "offers_offer"("businessId","storeId","id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "offers_offer_target" ADD CONSTRAINT "FK_883d75a57071877e3ac2ca1315f" FOREIGN KEY ("businessId", "storeId", "offerId") REFERENCES "offers_offer"("businessId","storeId","id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "offers_offer_target" DROP CONSTRAINT "FK_883d75a57071877e3ac2ca1315f"`, undefined);
        await queryRunner.query(`ALTER TABLE "offers_code" DROP CONSTRAINT "FK_ef86ff4fbe61730ea30b9d2bba4"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd36c73d8b90d3f1fdd21e461a"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_880cdb58e970ae52d42a527086"`, undefined);
        await queryRunner.query(`DROP TABLE "offers_offer_target"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c7b5add147e90d45820031358"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef86ff4fbe61730ea30b9d2bba"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd1dcd859014c798a60c69f1aa"`, undefined);
        await queryRunner.query(`DROP TABLE "offers_code"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a3ff24f5b3cd6499bcf21594e"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_98684a8236a447aa5409e08522"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d9e3592997d9f464bca83f0464"`, undefined);
        await queryRunner.query(`DROP TABLE "offers_offer"`, undefined);
   }

}
