import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile');
  const rootPackage = JSON.parse(read('package.json')) as { packageManager: string };

  it('activates the packageManager pnpm before copying the source', () => {
    const prepare = dockerfile.indexOf(`corepack prepare ${rootPackage.packageManager} --activate`);

    expect(prepare).toBeGreaterThan(-1);
    expect(prepare).toBeLessThan(dockerfile.indexOf('COPY . .'));
  });

  it('installs only the server and storefront closures', () => {
    expect(dockerfile).toContain(
      'pnpm install --frozen-lockfile --filter "@cod/server..." --filter "@cod/storefront..."',
    );
  });

  it('builds the storefront after the dashboard, with its deployment id, and ships its static files', () => {
    const lines = dockerfile.split('\n');
    const dashboardBuild = lines.findIndex((line) => line.includes('run build:dashboard'));
    const storefrontBuild = lines.findIndex((line) => line.includes('pnpm --filter @cod/storefront build'));
    const deploymentEnv = lines.findIndex((line) => line.trim() === 'ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID');

    expect(storefrontBuild).toBeGreaterThan(dashboardBuild);
    expect(deploymentEnv).toBeGreaterThanOrEqual(0);
    expect(deploymentEnv).toBeLessThan(storefrontBuild);
    expect(lines[storefrontBuild]).toContain('NODE_OPTIONS=--max-old-space-size=2048');
    expect(dockerfile).toContain('apps/storefront/.next/standalone/apps/storefront/.next/static');
  });

  it('runs the storefront role from the standalone server on 3001', () => {
    const entrypoint = read('scripts/docker-entrypoint.sh');

    expect(entrypoint).toMatch(
      /storefront\)\s+PORT=3001 HOSTNAME=0\.0\.0\.0 exec node apps\/storefront\/\.next\/standalone\/apps\/storefront\/server\.js/,
    );
  });

  it('builds the dashboard after the server, with placeholders the image does not keep (M5)', () => {
    const envLines = dockerfile.split('\n').filter((line) => line.startsWith('ENV '));

    const lines = dockerfile.split('\n');
    const serverBuild = lines.findIndex((line) => /\bpnpm\b.*\brun build$/.test(line.trim()));
    const dashboardBuild = lines.findIndex((line) => line.includes('run build:dashboard'));

    expect(serverBuild).toBeGreaterThanOrEqual(0);
    expect(dashboardBuild).toBeGreaterThanOrEqual(0);
    expect(dashboardBuild).toBeGreaterThan(serverBuild);
    expect(envLines.join('\n')).not.toMatch(/DASHBOARD_BUILD_|change-me|DATABASE_URL|SECRET/);
  });
});
