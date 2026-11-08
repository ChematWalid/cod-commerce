import { describe, expect, it } from 'vitest';
import { normalizeGeneratedMigration } from '../../src/scripts/normalize-migration';

// The shape of Vendure 3.8.1's `getTemplate`.
const GENERATED = `import {MigrationInterface, QueryRunner} from "typeorm";

export class Demo1 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
   }

}
`;

describe('normalizeGeneratedMigration', () => {
  it('makes the typeorm import type-only and both methods Promise<void>', () => {
    // Act
    const normalized = normalizeGeneratedMigration(GENERATED);

    // Assert
    expect(normalized).toContain('import type { MigrationInterface, QueryRunner } from "typeorm";');
    expect(normalized).not.toContain('Promise<any>');
    expect(normalized.match(/Promise<void>/g)).toHaveLength(2);
  });

  it('keeps a value import of another package', () => {
    // Arrange
    const withDedupe = GENERATED.replace('\n\n', '\nimport { deduplicateTranslations } from "@vendure/core";\n\n');

    // Act
    const normalized = normalizeGeneratedMigration(withDedupe);

    // Assert
    expect(normalized).toContain('import { deduplicateTranslations } from "@vendure/core";');
  });

  it('refuses a template it does not recognise', () => {
    expect(() => normalizeGeneratedMigration('export class Demo1 {}')).toThrow(/typeorm import/);
  });
});
