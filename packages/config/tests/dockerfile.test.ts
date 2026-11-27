import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

/** One build stage of the Dockerfile: its name and its instruction lines (continuations joined). */
interface Stage {
  readonly name: string;
  readonly lines: readonly string[];
}

/** Splits the Dockerfile into stages, joining `\`-continued lines and dropping comments. */
function stagesOf(dockerfile: string): Stage[] {
  const instructions = dockerfile
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  const stages: Stage[] = [];
  for (const line of instructions) {
    const from = /^FROM\s+\S+(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from !== null) {
      stages.push({ name: from[1] ?? '', lines: [line] });
      continue;
    }
    const current = stages.at(-1);
    if (current !== undefined) (current.lines as string[]).push(line);
  }
  return stages;
}

const SECRET_LIKE_NAME = /SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|CREDENTIAL|(?:^|_)KEYS?(?:_|$)|HMAC|KEK/i;

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile');
  const stages = stagesOf(dockerfile);
  const stage = (name: string): Stage => {
    const found = stages.find((candidate) => candidate.name === name);
    if (found === undefined) throw new Error(`no stage ${name}`);
    return found;
  };
  const runtime = stages.at(-1) ?? { name: '', lines: [] };
  const rootPackage = JSON.parse(read('package.json')) as { packageManager: string };

  it('is multi-stage: deps, build, then a runtime stage last', () => {
    expect(stages.map((candidate) => candidate.name)).toEqual(expect.arrayContaining(['deps', 'build', 'runtime']));
    expect(runtime.name).toBe('runtime');
  });

  it('pins every base image to a version and a digest', () => {
    const bases = stages
      .map((candidate) => candidate.lines[0] ?? '')
      .filter((line) => !/^FROM\s+(deps|build|base)\b/i.test(line));

    expect(bases.length).toBeGreaterThan(0);
    bases.forEach((line) => {
      expect(line).toMatch(/:\d[\w.-]*@sha256:[0-9a-f]{64}/);
    });
  });

  it('activates the packageManager pnpm before any source is copied', () => {
    const prepare = dockerfile.indexOf(`corepack prepare ${rootPackage.packageManager} --activate`);

    expect(prepare).toBeGreaterThan(-1);
    expect(prepare).toBeLessThan(dockerfile.indexOf('COPY . .'));
  });

  it('fetches dependencies from the lockfile alone, then installs only the server and storefront closures', () => {
    const deps = stage('deps').lines.join('\n');
    const build = stage('build').lines.join('\n');

    expect(deps).toContain('pnpm fetch');
    expect(deps).not.toContain('COPY . .');
    expect(build).toMatch(
      /pnpm install --offline --frozen-lockfile --filter "@cod\/server\.\.\." --filter "@cod\/storefront\.\.\."/,
    );
  });

  it('builds the dashboard after the server, without secret-named build args or ENV placeholders', () => {
    const build = stage('build').lines;
    const serverBuild = build.findIndex((line) => line.includes('--filter "@cod/server..." run build'));
    const dashboardBuild = build.findIndex((line) => line.includes('run build:dashboard'));
    const argNames = stages.flatMap((candidate) =>
      candidate.lines.filter((line) => line.startsWith('ARG ')).map((line) => line.slice(4).split('=')[0] ?? ''),
    );
    const envLines = stages.flatMap((candidate) => candidate.lines.filter((line) => line.startsWith('ENV ')));

    expect(serverBuild).toBeGreaterThan(-1);
    expect(dashboardBuild).toBeGreaterThan(serverBuild);
    expect(argNames.filter((name) => SECRET_LIKE_NAME.test(name))).toEqual([]);
    expect(envLines.join('\n')).not.toMatch(/change-me|DATABASE_URL|SECRET|PASSWORD/);
  });

  it('builds the storefront after the dashboard, with its deployment id and asset prefix', () => {
    const build = stage('build').lines;
    const dashboardBuild = build.findIndex((line) => line.includes('run build:dashboard'));
    const storefrontBuild = build.findIndex((line) => line.includes('pnpm --filter @cod/storefront build'));
    const deploymentEnv = build.findIndex((line) => line === 'ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID');
    const prefixArg = build.findIndex((line) => line.startsWith('ARG STOREFRONT_ASSET_PREFIX'));

    expect(storefrontBuild).toBeGreaterThan(dashboardBuild);
    expect(deploymentEnv).toBeGreaterThan(-1);
    expect(deploymentEnv).toBeLessThan(storefrontBuild);
    expect(prefixArg).toBeGreaterThan(-1);
    expect(prefixArg).toBeLessThan(storefrontBuild);
    expect(build[storefrontBuild]).toContain('STOREFRONT_ASSET_PREFIX="$STOREFRONT_ASSET_PREFIX"');
    expect(build[storefrontBuild]).toContain('NODE_OPTIONS=--max-old-space-size=2048');
  });

  it('prunes the server to its production dependencies with pnpm deploy from the lockfile', () => {
    expect(stage('build').lines.join('\n')).toMatch(
      /pnpm --filter @cod\/server deploy --prod --config\.inject-workspace-packages=true .*--offline/,
    );
  });

  // Writing the deploy's ~115k small files through overlayfs on a busy disk took over 40 min; into a tmpfs it
  // takes about 2 min, and one archive is a single sequential write.
  it('deploys the server into a tmpfs, with the shared store, and keeps it as one archive owned by node', () => {
    const deploy = stage('build').lines.find((line) => line.includes('@cod/server deploy')) ?? '';

    expect(deploy).toMatch(/^RUN --mount=type=tmpfs,target=\/out /);
    expect(deploy).toContain('--config.store-dir="$(pnpm store path)"');
    expect(deploy).toContain('tar -C /out -cf /server.tar --numeric-owner --owner=1000 --group=1000 server');
  });

  it('unpacks the server archive into /app/apps without copying it into a layer of its own', () => {
    const unpack = runtime.lines
      .filter((line) => line.includes('/server.tar'))
      .map((line) => line.replace(/\s+/g, ' '));

    expect(unpack).toEqual([
      'RUN --mount=type=bind,from=build,source=/server.tar,target=/tmp/server.tar mkdir -p /app/apps && tar -xf /tmp/server.tar --numeric-owner -C /app/apps',
    ]);
    expect(runtime.lines.findIndex((line) => line.includes('/server.tar'))).toBeLessThan(
      runtime.lines.indexOf('USER node'),
    );
  });

  it('ships no toolchain, source tree or dev dependencies in the runtime stage', () => {
    const body = runtime.lines.join('\n');

    expect(body).not.toContain('COPY . .');
    expect(body).not.toMatch(/pnpm (install|fetch|deploy)|corepack/);
    expect(body).not.toMatch(/COPY --from=build \/app\/node_modules\b/);
  });

  it('copies the compiled server and every storefront artefact to the same /app paths', () => {
    const copies = runtime.lines.filter((line) => line.startsWith('COPY --from=build'));
    const targets = copies.map((line) => line.split(/\s+/).at(-1));

    expect(targets).toEqual(
      expect.arrayContaining([
        '/app/apps/server/dist',
        '/app/apps/storefront/cache/dist',
        '/app/apps/storefront/.next/standalone',
        '/app/apps/storefront/.next/standalone/apps/storefront/.next/static',
      ]),
    );
    copies.forEach((line) => {
      expect(line).toContain('--chown=node:node');
    });
  });

  it('runs as the non-root node user with UTC and production settings', () => {
    const user = runtime.lines.filter((line) => line.startsWith('USER '));
    const env = runtime.lines.filter((line) => line.startsWith('ENV ')).join(' ');

    expect(user.at(-1)).toBe('USER node');
    expect(env).toContain('TZ=UTC');
    expect(env).toContain('NODE_ENV=production');
    expect(env).toContain('NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID');
  });

  it('declares a role-aware HEALTHCHECK and the role entry point', () => {
    const body = runtime.lines.join('\n');

    expect(body).toMatch(/^HEALTHCHECK .*CMD \["sh", ?"\/app\/scripts\/docker-healthcheck\.sh"\]/m);
    expect(body).toContain('ENTRYPOINT ["sh","/app/scripts/docker-entrypoint.sh"]');
  });
});

describe('scripts/docker-entrypoint.sh', () => {
  const entrypoint = read('scripts/docker-entrypoint.sh');

  it('runs the storefront role from the standalone server on 3001', () => {
    expect(entrypoint).toMatch(
      /storefront\)\s+PORT=3001 HOSTNAME=0\.0\.0\.0 exec node apps\/storefront\/\.next\/standalone\/apps\/storefront\/server\.js/,
    );
  });

  it('execs a given command instead of the ROLE dispatch (kamal app exec, one-off tasks)', () => {
    expect(entrypoint).toMatch(/if \[ "\$#" -gt 0 \]; then\s+exec "\$@"/);
  });

  it('preloads OpenTelemetry with --require when the image carries the preload', () => {
    expect(entrypoint).toContain('--require');
    expect(entrypoint).not.toContain('NODE_OPTIONS');
  });
});

describe('scripts/docker-healthcheck.sh', () => {
  const healthcheck = read('scripts/docker-healthcheck.sh');

  it('probes /readyz of the api and worker roles through the server healthcheck', () => {
    expect(healthcheck).toMatch(/api \| worker\)\s+exec node apps\/server\/dist\/healthcheck\.js/);
  });

  it('probes the storefront on 3001 and passes for migrate', () => {
    expect(healthcheck).toContain('http://127.0.0.1:3001/readyz');
    expect(healthcheck).toMatch(/migrate\)\s+exit 0/);
  });
});

describe('.dockerignore', () => {
  const ignored = read('.dockerignore').split('\n');

  it('keeps env files, git metadata and local caches out of the build context', () => {
    expect(ignored).toEqual(expect.arrayContaining(['.git', '.env', '**/.env', '**/.env.*', '**/node_modules']));
  });
});

interface ComposeService {
  build?: { args?: Record<string, string> };
  environment?: Record<string, string>;
  stop_grace_period?: string;
}

describe('docker-compose.yml app roles', () => {
  const compose = parse(read('docker-compose.yml'), { merge: true }) as { services: Record<string, ComposeService> };
  const storefront = compose.services['storefront'];

  it('passes NEXT_DEPLOYMENT_ID to the image build only', () => {
    expect(storefront?.build?.args?.['NEXT_DEPLOYMENT_ID']).toBe('${NEXT_DEPLOYMENT_ID:-local}');
    // A runtime value could differ from the one the assets were built with; the image ENV is the only source.
    expect(Object.keys(storefront?.environment ?? {})).not.toContain('NEXT_DEPLOYMENT_ID');
  });

  it('passes the static files prefix to the build, which the standalone output embeds', () => {
    expect(storefront?.build?.args?.['STOREFRONT_ASSET_PREFIX']).toBe('${STOREFRONT_ASSET_PREFIX:-}');
  });

  it.each([
    ['api', '35s'],
    ['storefront', '35s'],
    ['worker', '75s'],
  ])('gives %s a %s stop grace, above its drain deadline (ADR 0013)', (service, grace) => {
    expect(compose.services[service]?.stop_grace_period).toBe(grace);
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
