import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformFlags1794800000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "feature_flag" ("key" character varying(100) NOT NULL, "description" character varying(200) NOT NULL, "defaultEnabled" boolean NOT NULL, "rolloutPercent" integer NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedBy" character varying(64), CONSTRAINT "feature_flag_rollout_range" CHECK ("rolloutPercent" >= 0 AND "rolloutPercent" <= 100), CONSTRAINT "PK_960310efa932f7a29eec57350b3" PRIMARY KEY ("key"))`, undefined);
        await queryRunner.query(`CREATE TABLE "feature_flag_override" ("id" bigint NOT NULL, "flagKey" character varying(100) NOT NULL, "scope" character varying(16) NOT NULL, "scopeId" character varying(64) NOT NULL, "enabled" boolean NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_feature_flag_override_target" UNIQUE ("flagKey", "scope", "scopeId"), CONSTRAINT "feature_flag_override_scope" CHECK ("scope" IN ('plan', 'business', 'store')), CONSTRAINT "PK_d7b0135b3655971c08ee894f77c" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "feature_flag_override" ADD CONSTRAINT "FK_8f11aef3fd3fe00d2456584494b" FOREIGN KEY ("flagKey") REFERENCES "feature_flag"("key") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feature_flag_override" DROP CONSTRAINT "FK_8f11aef3fd3fe00d2456584494b"`, undefined);
        await queryRunner.query(`DROP TABLE "feature_flag_override"`, undefined);
        await queryRunner.query(`DROP TABLE "feature_flag"`, undefined);
   }

}
