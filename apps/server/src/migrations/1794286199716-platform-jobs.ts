import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformJobs1794286199716 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "platform_task_heartbeat" ("taskId" character varying(100) NOT NULL, "lastSuccessAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_640dccc8a3395249599c2ed88b2" PRIMARY KEY ("taskId"))`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "platform_task_heartbeat"`, undefined);
   }

}
