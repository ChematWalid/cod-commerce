import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_DIR = join(__dirname, '../dashboard');
const PLACEHOLDER_PATH = '/merchant-shell';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the P0 placeholder route (#175)', () => {
  it('is no longer declared by any dashboard file of the shell', () => {
    // Arrange
    const files = sourceFiles(DASHBOARD_DIR);

    // Act
    const declaring = files.filter((file) => readFileSync(file, 'utf8').includes(`'${PLACEHOLDER_PATH}'`));

    // Assert
    expect(files.length).toBeGreaterThan(0);
    expect(declaring).toEqual([]);
  });
});
