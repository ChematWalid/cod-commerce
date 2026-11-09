import type { MigrationInterface, QueryRunner } from "typeorm";

export class Rbac1794224390730 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "activity_log" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "actorAdministratorId" integer, "action" character varying(64) NOT NULL, "entityType" character varying(32) NOT NULL, "entityId" character varying(32) NOT NULL, "summary" character varying(255) NOT NULL, "diff" jsonb NOT NULL, "ip" character varying(64), "userAgent" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_067d761e2956b77b14e534fd6f1" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_2fde88f5a72890faa80b562b63" ON "activity_log" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d7928002392420b34a7ce2c036" ON "activity_log" ("businessId", "action", "id") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d347e02f331af18250c1233cf5" ON "activity_log" ("businessId", "actorAdministratorId", "id") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_0b24949b8eaf781c929ae2a59e" ON "activity_log" ("businessId", "id") `, undefined);
        await queryRunner.query(`CREATE TABLE "business_role" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "name" character varying(60) NOT NULL, "nameKey" character varying(240) NOT NULL, "description" character varying(255), "builtInKey" character varying(32), "permissions" text array NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_de3dafd44c6c2b8edc21079503b" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_964871461f870b29e50e606c28" ON "business_role" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a3a47332de1be996988c5de64a" ON "business_role" ("businessId", "builtInKey") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2da392b22c8e3efbe3ec077b56" ON "business_role" ("businessId", "nameKey") `, undefined);
        await queryRunner.query(`CREATE TABLE "member_role_assignment" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "administratorId" integer NOT NULL, "businessRoleId" bigint NOT NULL, "storeAccess" character varying(10) NOT NULL, "storeIds" bigint array NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_852a3fe8c276360b376403a5b92" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40b99a64ae73f5fc7419d909bb" ON "member_role_assignment" ("businessId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ea50717fd8ed9f42f156cce487" ON "member_role_assignment" ("businessId", "businessRoleId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f06f7ad8f9d1f056425c837c20" ON "member_role_assignment" ("businessId", "administratorId", "businessRoleId") `, undefined);
        await queryRunner.query(`CREATE TABLE "role_binding" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "businessRoleId" bigint NOT NULL, "scope" character varying(20) NOT NULL, "vendureRoleId" integer NOT NULL, CONSTRAINT "PK_94c1497e2c1cb0e61f24d82d9e4" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_39c83a0e1d63fe46c4d7c8175f" ON "role_binding" ("businessId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df22172033a9bdb4e404bc2061" ON "role_binding" ("businessRoleId", "scope") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_df22172033a9bdb4e404bc2061"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_39c83a0e1d63fe46c4d7c8175f"`, undefined);
        await queryRunner.query(`DROP TABLE "role_binding"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f06f7ad8f9d1f056425c837c20"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ea50717fd8ed9f42f156cce487"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_40b99a64ae73f5fc7419d909bb"`, undefined);
        await queryRunner.query(`DROP TABLE "member_role_assignment"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_2da392b22c8e3efbe3ec077b56"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3a47332de1be996988c5de64a"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_964871461f870b29e50e606c28"`, undefined);
        await queryRunner.query(`DROP TABLE "business_role"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b24949b8eaf781c929ae2a59e"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d347e02f331af18250c1233cf5"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d7928002392420b34a7ce2c036"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fde88f5a72890faa80b562b63"`, undefined);
        await queryRunner.query(`DROP TABLE "activity_log"`, undefined);
   }

}
