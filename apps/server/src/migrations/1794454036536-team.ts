import type { MigrationInterface, QueryRunner } from "typeorm";

export class Team1794454036536 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "commission_config" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "name" character varying(60) NOT NULL, "nameKey" character varying(240) NOT NULL, "basis" character varying(32) NOT NULL, "valueKind" character varying(10) NOT NULL, "value" integer NOT NULL, "scope" character varying(10) NOT NULL, "storeIds" bigint array NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3bf0fcf292dc9e54cdf9853f3c8" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_09029ff2cb23e8c2e9ded891c4" ON "commission_config" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_932fb4d321c5eec00808ca2460" ON "commission_config" ("businessId", "nameKey") `, undefined);
        await queryRunner.query(`CREATE TABLE "invitation" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "memberId" bigint NOT NULL, "grant" jsonb NOT NULL, "tokenHash" character(64) NOT NULL, "locale" character varying(2) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastSentAt" TIMESTAMP WITH TIME ZONE NOT NULL, "resendCount" integer NOT NULL, "invitedByAdministratorId" integer NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "acceptedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_beb994737756c0f18a1c1f8669c" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_be203d5fc1e805d6bd8fa81586" ON "invitation" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_676ef6471ce7176869d73365a4" ON "invitation" ("tokenHash") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b355a3033f4de401dd1ad2f442" ON "invitation" ("businessId", "memberId") `, undefined);
        await queryRunner.query(`CREATE TABLE "salary_payment" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "memberId" bigint NOT NULL, "amount" integer NOT NULL, "idempotencyKey" character varying(64) NOT NULL, "paidByAdministratorId" integer NOT NULL, "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4ea823057c3c7c9c461628b9faa" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9e8aa2ce9a62ead79ff15f958d" ON "salary_payment" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6a31434d3c0ec4977a2d99002" ON "salary_payment" ("businessId", "memberId", "idempotencyKey") `, undefined);
        await queryRunner.query(`CREATE TABLE "team_member" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "administratorId" integer, "email" character varying(320) NOT NULL, "emailKey" character varying(320) NOT NULL, "firstName" character varying(100), "lastName" character varying(100), "status" character varying(10) NOT NULL, "suspendedAccess" jsonb, "commissionConfigIds" bigint array NOT NULL, "baseSalary" integer NOT NULL, "maxOpenOrders" integer, "receivingOrders" boolean NOT NULL, "invitedByAdministratorId" integer, "invitedAt" TIMESTAMP WITH TIME ZONE, "joinedAt" TIMESTAMP WITH TIME ZONE, "removedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_649680684d72a20d279641469c5" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bdc542fa17d34dde2c2548a8f5" ON "team_member" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_98f9850ef5039b441b484ddac5" ON "team_member" ("businessId", "status", "id") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9af5e53d251ff216afefbe99b1" ON "team_member" ("businessId", "administratorId") WHERE "administratorId" IS NOT NULL`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_351cd414583541b8246dd00733" ON "team_member" ("businessId", "emailKey") WHERE "removedAt" IS NULL`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_351cd414583541b8246dd00733"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9af5e53d251ff216afefbe99b1"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_98f9850ef5039b441b484ddac5"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdc542fa17d34dde2c2548a8f5"`, undefined);
        await queryRunner.query(`DROP TABLE "team_member"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6a31434d3c0ec4977a2d99002"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e8aa2ce9a62ead79ff15f958d"`, undefined);
        await queryRunner.query(`DROP TABLE "salary_payment"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b355a3033f4de401dd1ad2f442"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_676ef6471ce7176869d73365a4"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_be203d5fc1e805d6bd8fa81586"`, undefined);
        await queryRunner.query(`DROP TABLE "invitation"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_932fb4d321c5eec00808ca2460"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_09029ff2cb23e8c2e9ded891c4"`, undefined);
        await queryRunner.query(`DROP TABLE "commission_config"`, undefined);
   }

}
