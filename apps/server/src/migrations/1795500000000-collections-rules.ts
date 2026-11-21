import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionsRules1795500000000 implements MigrationInterface {
  name = 'CollectionsRules1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "collections_definition" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "collectionId" integer NOT NULL, "mode" character varying(16) NOT NULL, "match" character varying(16), "rule" jsonb, "matchVersion" integer NOT NULL, "visible" boolean NOT NULL, "position" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "collections_definition_store_required" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_17ff0f5fda32a7564e5e1c2d18d" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1b8aa13c37f679cd35d5ab7dea" ON "collections_definition" ("businessId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59bf4d7c171ad81955749d32d2" ON "collections_definition" ("businessId", "storeId", "position", "id") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ade0d2bdab6aa7103c7de43ce4" ON "collections_definition" ("businessId", "storeId", "collectionId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c07cf856120d1b07e1a7561852" ON "collections_definition" ("businessId", "collectionId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "collections_member" ("businessId" bigint NOT NULL, "storeId" bigint, "id" bigint NOT NULL, "collectionId" integer NOT NULL, "productId" integer NOT NULL, "position" integer NOT NULL, CONSTRAINT "collections_member_store_required" CHECK ("storeId" IS NOT NULL), CONSTRAINT "PK_839742a2820510549c12113fe9e" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe78317d832752265f2fc5771f" ON "collections_member" ("businessId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7f98bbaac9f2ea484270a0602" ON "collections_member" ("businessId", "collectionId", "position", "productId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_372ecdf9f301da264ff8000d00" ON "collections_member" ("businessId", "storeId", "productId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_69d8c77edc0651de162031edb4" ON "collections_member" ("businessId", "collectionId", "productId") `,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "collections_member" ADD CONSTRAINT "FK_3f9b17860d939a33786d0d71cfe" FOREIGN KEY ("businessId", "storeId", "collectionId") REFERENCES "collections_definition"("businessId","storeId","collectionId") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collections_member" DROP CONSTRAINT "FK_3f9b17860d939a33786d0d71cfe"`,
      undefined,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_69d8c77edc0651de162031edb4"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_372ecdf9f301da264ff8000d00"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_d7f98bbaac9f2ea484270a0602"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_fe78317d832752265f2fc5771f"`, undefined);
    await queryRunner.query(`DROP TABLE "collections_member"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_c07cf856120d1b07e1a7561852"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_ade0d2bdab6aa7103c7de43ce4"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_59bf4d7c171ad81955749d32d2"`, undefined);
    await queryRunner.query(`DROP INDEX "public"."IDX_1b8aa13c37f679cd35d5ab7dea"`, undefined);
    await queryRunner.query(`DROP TABLE "collections_definition"`, undefined);
  }
}
