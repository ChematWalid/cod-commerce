import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * P3.S1 (D3103, D3116): the global wilaya and commune tables `geo_province` and `geo_town`, with no tenant column.
 * Tables only: `GeoSeedService.converge()` fills them on every migrate.
 */
export class Geo1795600000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "geo_province" ("code" character varying(2) NOT NULL, "name" character varying(100) NOT NULL, "arabicName" character varying(100) NOT NULL, "names" jsonb NOT NULL, CONSTRAINT "PK_caa60e6c0be2b1e650a268733b8" PRIMARY KEY ("code"))`, undefined);
        await queryRunner.query(`CREATE TABLE "geo_town" ("codeOns" integer NOT NULL, "provinceCode" character varying(2) NOT NULL, "name" character varying(100) NOT NULL, "arabicName" character varying(100) NOT NULL, "names" jsonb NOT NULL, "isStopdesk" boolean NOT NULL, "isHomeDelivery" boolean NOT NULL, CONSTRAINT "PK_4faabe59c2e795e6163003dd368" PRIMARY KEY ("codeOns"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_3db594830418d55b02f19fe5dc" ON "geo_town" ("provinceCode") `, undefined);
        await queryRunner.query(`ALTER TABLE "geo_town" ADD CONSTRAINT "FK_3db594830418d55b02f19fe5dce" FOREIGN KEY ("provinceCode") REFERENCES "geo_province"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "geo_town" DROP CONSTRAINT "FK_3db594830418d55b02f19fe5dce"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_3db594830418d55b02f19fe5dc"`, undefined);
        await queryRunner.query(`DROP TABLE "geo_town"`, undefined);
        await queryRunner.query(`DROP TABLE "geo_province"`, undefined);
   }

}
