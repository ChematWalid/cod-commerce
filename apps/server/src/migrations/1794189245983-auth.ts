import type { MigrationInterface, QueryRunner } from "typeorm";

export class Auth1794189245983 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "account_token" ("id" bigint NOT NULL, "userId" integer, "purpose" character varying(32) NOT NULL, "tokenHash" character(64) NOT NULL, "otpHash" character(64), "otpAttempts" integer NOT NULL DEFAULT '0', "otpLockedAt" TIMESTAMP WITH TIME ZONE, "pendingEmail" character varying(255), "payload" jsonb, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "account_token_user_required" CHECK ("userId" IS NOT NULL OR "purpose" = 'oauth-ticket'), CONSTRAINT "PK_a55842d3341d42534e39f85e931" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ca15dea3ff807360bfdd30d957" ON "account_token" ("userId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1261696c0041394536e91c0a81" ON "account_token" ("tokenHash") `, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD "customFieldsEmailverifiedat" TIMESTAMP(6)`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD "customFieldsPhone" character varying(20)`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD "customFieldsEmaillocale" character varying(2) NOT NULL DEFAULT 'ar'`, undefined);
        // D23: every administrator who exists before email verification counts as verified from the day they were created.
        await queryRunner.query(`UPDATE "administrator" SET "customFieldsEmailverifiedat" = "createdAt"`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "customFieldsEmaillocale"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "customFieldsPhone"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "customFieldsEmailverifiedat"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_1261696c0041394536e91c0a81"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca15dea3ff807360bfdd30d957"`, undefined);
        await queryRunner.query(`DROP TABLE "account_token"`, undefined);
   }

}
