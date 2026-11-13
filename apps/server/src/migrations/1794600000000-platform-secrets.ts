import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformSecrets1794600000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenant_data_key" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "kid" character varying(16) NOT NULL, "iv" bytea NOT NULL, "wrappedKey" bytea NOT NULL, "tag" bytea NOT NULL, "rotatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c93da13ccdecd05255eae33de24" UNIQUE ("businessId"), CONSTRAINT "PK_59bff9e2c66e92a1e22309b33e1" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_c93da13ccdecd05255eae33de2" ON "tenant_data_key" ("businessId") `, undefined);
        await queryRunner.query(`CREATE TABLE "tenant_secret" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "provider" character varying(40) NOT NULL, "ref" character varying(100) NOT NULL, "dataKeyId" bigint NOT NULL, "iv" bytea NOT NULL, "ciphertext" bytea NOT NULL, "tag" bytea NOT NULL, "last4" character varying(4), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1091b35dcbfc9a98a3f74955592" UNIQUE ("businessId", "provider", "ref"), CONSTRAINT "PK_a8b22a90129b0dc8d0314b6a25d" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_2d90516dd666a7f87945b5924b" ON "tenant_secret" ("businessId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2d90516dd666a7f87945b5924b"`, undefined);
        await queryRunner.query(`DROP TABLE "tenant_secret"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_c93da13ccdecd05255eae33de2"`, undefined);
        await queryRunner.query(`DROP TABLE "tenant_data_key"`, undefined);
   }

}
