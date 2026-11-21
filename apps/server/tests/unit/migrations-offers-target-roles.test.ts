import { OFFER_TARGET_ROLES } from '@cod/shared';
import type { QueryRunner } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { OffersTargetRoles1795500000000 } from '../../src/migrations/1795500000000-offers-target-roles';

/** The check the target entity declares (`TARGET_ROLE_CHECK` of the offers plugin), built the same way. */
const ENTITY_ROLE_CHECK = `"role" IN (${OFFER_TARGET_ROLES.map((role) => `'${role}'`).join(', ')})`;

/** A query runner that records every statement and answers `rows` to each one. */
function aRecordingRunner(rows: readonly unknown[] = []) {
  const statements: string[] = [];
  const runner = {
    query: (sql: string) => {
      statements.push(sql);
      return Promise.resolve(rows);
    },
  } as unknown as QueryRunner;
  return { runner, statements };
}

describe('the offers target-roles migration (D2502)', () => {
  it('widens the role check to buy, get and addon', async () => {
    // Arrange
    const { runner, statements } = aRecordingRunner();

    // Act
    await new OffersTargetRoles1795500000000().up(runner);

    // Assert
    expect(statements).toEqual([
      'ALTER TABLE "offers_offer_target" DROP CONSTRAINT "CHK_offers_offer_target_role"',
      `ALTER TABLE "offers_offer_target" ADD CONSTRAINT "CHK_offers_offer_target_role" CHECK ("role" IN ('buy', 'get', 'addon'))`,
    ]);
    expect(statements[1]).toContain(`CHECK (${ENTITY_ROLE_CHECK})`);
  });

  it('restores the buy-only check when no get or addon row exists', async () => {
    // Arrange
    const { runner, statements } = aRecordingRunner();

    // Act
    await new OffersTargetRoles1795500000000().down(runner);

    // Assert
    expect(statements.slice(1)).toEqual([
      'ALTER TABLE "offers_offer_target" DROP CONSTRAINT "CHK_offers_offer_target_role"',
      `ALTER TABLE "offers_offer_target" ADD CONSTRAINT "CHK_offers_offer_target_role" CHECK ("role" IN ('buy'))`,
    ]);
  });

  it('refuses to narrow the check while get or addon rows exist', async () => {
    // Arrange
    const { runner, statements } = aRecordingRunner([{ exists: 1 }]);

    // Act
    const reverting = new OffersTargetRoles1795500000000().down(runner);

    // Assert
    await expect(reverting).rejects.toThrow(/get or addon/);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain(`"role" <> 'buy'`);
  });
});
