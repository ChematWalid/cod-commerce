import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * P2.S5 (D2502): offer targets may also be `get` (BXGY gifts) and `addon` (add-on products). The named check of
 * D2439 is dropped and recreated with the three roles of `OFFER_TARGET_ROLES`; the drift gate compares it by name.
 */
export class OffersTargetRoles1795500000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "offers_offer_target" DROP CONSTRAINT "CHK_offers_offer_target_role"`);
        await queryRunner.query(`ALTER TABLE "offers_offer_target" ADD CONSTRAINT "CHK_offers_offer_target_role" CHECK ("role" IN ('buy', 'get', 'addon'))`);
   }

   /** Narrowing back to `buy` would fail on (or silently need to delete) get/addon rows: refuse while any exists. */
   public async down(queryRunner: QueryRunner): Promise<void> {
        const rows: unknown = await queryRunner.query(`SELECT 1 FROM "offers_offer_target" WHERE "role" <> 'buy' LIMIT 1`);
        if (Array.isArray(rows) && rows.length > 0) {
            throw new Error('Cannot revert OffersTargetRoles1795500000000: offer targets with the get or addon role exist');
        }
        await queryRunner.query(`ALTER TABLE "offers_offer_target" DROP CONSTRAINT "CHK_offers_offer_target_role"`);
        await queryRunner.query(`ALTER TABLE "offers_offer_target" ADD CONSTRAINT "CHK_offers_offer_target_role" CHECK ("role" IN ('buy'))`);
   }

}
