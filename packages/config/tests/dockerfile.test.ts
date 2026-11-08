import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

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

interface ComposeService {
  build?: { args?: Record<string, string> };
  environment?: Record<string, string>;
}

describe('storefront deployment id (one source: the image)', () => {
  const compose = parse(read('docker-compose.yml'), { merge: true }) as { services: Record<string, ComposeService> };
  const storefront = compose.services['storefront'];

  it('passes NEXT_DEPLOYMENT_ID to the image build only', () => {
    expect(storefront?.build?.args?.['NEXT_DEPLOYMENT_ID']).toBe('${NEXT_DEPLOYMENT_ID:-local}');
    // A runtime value could differ from the one the assets were built with; the image ENV is the only source.
    expect(Object.keys(storefront?.environment ?? {})).not.toContain('NEXT_DEPLOYMENT_ID');
  });

  it('keeps a constant deployment id out of the root .env.example', () => {
    // A constant id makes a rebuilt storefront read the previous build's App Shell from the persistent Valkey.
    expect(read('.env.example')).not.toMatch(/^NEXT_DEPLOYMENT_ID=/m);
  });

  it('builds the verify-stack image with the commit id, marked dirty for an uncommitted tree', () => {
    const script = read('scripts/verify-stack.sh');
    const exportLine = script.search(/^export NEXT_DEPLOYMENT_ID\b/m);

    expect(exportLine).toBeGreaterThan(-1);
    expect(script).toContain('git rev-parse --short HEAD');
    expect(script).toContain('git status --porcelain');
    expect(exportLine).toBeLessThan(script.indexOf('docker compose build'));
  });
});
