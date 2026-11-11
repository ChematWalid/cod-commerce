import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTBOX_SCHEMAS } from '@cod/plugin-platform-outbox';
import { describe, expect, it } from 'vitest';

const MIGRATION = join(__dirname, '../../src/migrations/1794513300000-platform-outbox.ts');

describe('the platform-outbox migration', () => {
  it('holds every statement of OUTBOX_SCHEMAS verbatim', () => {
    // Arrange
    const migration = readFileSync(MIGRATION, 'utf8');
    const statements = OUTBOX_SCHEMAS.flatMap((schema) => schema.createSql.split(';\n  '));

    // Assert
    expect(statements).toHaveLength(4);
    for (const statement of statements) {
      expect(migration).toContain(statement);
    }
  });
});
