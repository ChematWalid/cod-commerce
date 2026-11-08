import type { MigrationInterface, QueryRunner } from "typeorm";

export class Tenancy1794158050439 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "business_order_sequence" ("businessId" bigint NOT NULL, "last" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_0adce8903c088f91c8921554fc5" PRIMARY KEY ("businessId"))`, undefined);
        await queryRunner.query(`CREATE TABLE "business" ("id" bigint NOT NULL, "name" character varying(255) NOT NULL, "logoAssetId" integer, "onboardingState" jsonb NOT NULL DEFAULT '{}', "ownerAdministratorId" integer, "sellerId" integer NOT NULL, "ownerRoleId" integer, "planId" bigint, "status" character varying(20) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_0bd850da8dafab992e2e9b058e5" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "custom_domain" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "host" character varying(253) NOT NULL, "verifiedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_8ceb5cdfbe937c988e4b0856225" UNIQUE ("host"), CONSTRAINT "PK_76b2cc5a1514eeffc66184c922a" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_598ff8170b3a37af7aa2253940" ON "custom_domain" ("businessId") `, undefined);
        await queryRunner.query(`CREATE TABLE "store" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "channelId" integer NOT NULL, "sellerId" integer NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "logoAssetId" integer, "language" character varying(16) NOT NULL, "subdomain" character varying(30) NOT NULL, "defaultDeliveryFeeGroupId" bigint, "defaultCarrierId" bigint, "showAddressField" boolean NOT NULL DEFAULT true, "soldOutBehavior" character varying(20) NOT NULL DEFAULT 'keep', "status" character varying(20) NOT NULL, "archivedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_90f21478c103fbd855b754cc1c4" UNIQUE ("channelId"), CONSTRAINT "UQ_52a4191a987abb10a4120cba7d5" UNIQUE ("subdomain"), CONSTRAINT "store_subdomain_lowercase" CHECK ("subdomain" = lower("subdomain")), CONSTRAINT "PK_f3172007d4de5ae8e7692759d79" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bc7ec2c93335da88571ae84fbe" ON "store" ("businessId") `, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD "customFieldsBusinessid" character varying(20)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_399bfc1b088d59053c17456165" ON "administrator" ("customFieldsBusinessid") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_399bfc1b088d59053c17456165"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "customFieldsBusinessid"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc7ec2c93335da88571ae84fbe"`, undefined);
        await queryRunner.query(`DROP TABLE "store"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_598ff8170b3a37af7aa2253940"`, undefined);
        await queryRunner.query(`DROP TABLE "custom_domain"`, undefined);
        await queryRunner.query(`DROP TABLE "business"`, undefined);
        await queryRunner.query(`DROP TABLE "business_order_sequence"`, undefined);
   }

}
