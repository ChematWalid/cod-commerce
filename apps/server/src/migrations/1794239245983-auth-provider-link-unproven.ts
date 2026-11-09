import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuthProviderLinkUnproven1794239245983 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "administrator" ADD "customFieldsProviderlinkunproven" boolean NOT NULL DEFAULT false`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "customFieldsProviderlinkunproven"`, undefined);
   }

}
