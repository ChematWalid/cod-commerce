import type { MigrationInterface, QueryRunner } from "typeorm";

export class TemplateNoteTenantEntity1794168034555 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "template_note" ADD "storeId" bigint`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e825d158056b17c4d5234515c4" ON "template_note" ("businessId", "createdAt", "id") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e825d158056b17c4d5234515c4"`, undefined);
        await queryRunner.query(`ALTER TABLE "template_note" DROP COLUMN "storeId"`, undefined);
   }

}
