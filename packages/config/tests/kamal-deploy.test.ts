import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = resolve(__dirname, '../../..');

interface Env {
  clear?: Record<string, string | number | boolean>;
  secret?: unknown[];
}
interface Proxy {
  hosts?: string[];
  app_port?: number;
  ssl?: { certificate_pem?: string; private_key_pem?: string };
  ssl_redirect?: boolean;
  healthcheck?: { path?: string };
}
interface Role {
  hosts?: string[];
  proxy?: Proxy | boolean;
  env?: Env;
  options?: Record<string, string | number>;
}
interface KamalConfig {
  service?: string;
  image?: string;
  primary_role?: string;
  require_destination?: boolean;
  drain_timeout?: number;
  deploy_timeout?: number;
  registry?: { server?: string; username?: string; password?: unknown[] };
  servers?: Record<string, Role>;
  env?: Env;
}

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
// ERB tags sit inside quoted YAML strings, so the files parse as plain YAML without rendering them.
const base = parse(read('config/deploy.yml')) as KamalConfig;
const staging = parse(read('config/deploy.staging.yml')) as KamalConfig;
const roles = base.servers ?? {};
const stagingRoles = staging.servers ?? {};
// The hook's commands without comments, with backslash continuations joined into one line each.
const hook = read('.kamal/hooks/pre-deploy')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n')
  .replace(/\\\n\s*/g, '');

const proxyOf = (role: string): Proxy => {
  const proxy = roles[role]?.proxy;
  return typeof proxy === 'object' ? proxy : {};
};
const stagingProxyOf = (role: string): Proxy => {
  const proxy = stagingRoles[role]?.proxy;
  return typeof proxy === 'object' ? proxy : {};
};
const clearOf = (role: string): Record<string, unknown> => ({
  ...base.env?.clear,
  ...roles[role]?.env?.clear,
  ...staging.env?.clear,
  ...stagingRoles[role]?.env?.clear,
});
const secretsOf = (role: string): unknown[] => [...(roles[role]?.env?.secret ?? []), ...(base.env?.secret ?? [])];
const secretsFileNames = read('.kamal/secrets.example')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .map((line) => line.split('=')[0]);
const isIgnoredByGit = (path: string): boolean => {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    // git check-ignore exits 1 when the path is not ignored.
    return false;
  }
};

describe('Kamal staging deploy (config/deploy.yml + config/deploy.staging.yml)', () => {
  it('deploys the one platform image from GHCR with only a named registry secret', () => {
    expect(base.service).toBe('platform');
    expect(base.image).toMatch(/\/platform$/);
    expect(base.registry?.server).toBe('ghcr.io');
    expect(base.registry?.password).toEqual(['KAMAL_REGISTRY_PASSWORD']);
    expect(base.require_destination).toBe(true);
  });

  it('runs api, worker and storefront roles, with api as the primary role', () => {
    expect(Object.keys(roles).sort()).toEqual(['api', 'storefront', 'worker']);
    expect(base.primary_role).toBe('api');
    expect(Object.keys(stagingRoles).sort()).toEqual(['api', 'storefront', 'worker']);
  });

  it.each([
    ['api', 'api', '1000m', '--max-old-space-size=768'],
    ['worker', 'worker', '1000m', '--max-old-space-size=768'],
    ['storefront', 'storefront', '700m', '--max-old-space-size=512'],
  ])('gives the %s role ROLE=%s, a %s memory limit and the heap flag %s', (role, roleEnv, memory, heap) => {
    expect(clearOf(role)['ROLE']).toBe(roleEnv);
    expect(roles[role]?.options?.['memory']).toBe(memory);
    expect(clearOf(role)['NODE_OPTIONS']).toBe(heap);
  });

  it('joins every role to the compose data tier network', () => {
    for (const role of Object.values(roles)) {
      expect(role.options?.['network']).toBe('cod_default');
    }
  });

  it('routes app., api. and api.internal to the api, checked on /readyz', () => {
    const proxy = { ...proxyOf('api'), ...stagingProxyOf('api') };
    expect(proxy.app_port).toBe(3000);
    expect(proxy.healthcheck?.path).toBe('/readyz');
    expect(proxy.hosts).toEqual(expect.arrayContaining(['api.internal']));
    expect(proxy.hosts?.some((host) => host.startsWith('app.'))).toBe(true);
    expect(proxy.hosts?.some((host) => host.startsWith('api.') && host !== 'api.internal')).toBe(true);
  });

  it('routes store hosts and storefront.internal to the storefront, checked on its own /readyz', () => {
    const proxy = { ...proxyOf('storefront'), ...stagingProxyOf('storefront') };
    expect(proxy.app_port).toBe(3001);
    expect(proxy.healthcheck?.path).toBe('/readyz');
    expect(proxy.hosts).toEqual(expect.arrayContaining(['storefront.internal']));
    expect(proxy.hosts?.some((host) => host.startsWith('*.'))).toBe(true);
  });

  it('terminates TLS with the Origin CA certificate from secrets, never from the file', () => {
    for (const role of ['api', 'storefront']) {
      expect(proxyOf(role).ssl).toEqual({
        certificate_pem: 'ORIGIN_CA_CERTIFICATE_PEM',
        private_key_pem: 'ORIGIN_CA_PRIVATE_KEY_PEM',
      });
      // The node-internal hosts are plain HTTP on the kamal network; a redirect would break them.
      expect(proxyOf(role).ssl_redirect).toBe(false);
    }
  });

  it('keeps the worker out of the proxy and gives it a drain above its 65 s watchdog', () => {
    expect(roles['worker']?.proxy).toBeUndefined();
    expect(base.drain_timeout).toBeGreaterThanOrEqual(70);
  });

  it('lets proxied roles finish their 25 s drain before docker kills them', () => {
    // kamal-proxy drains proxied roles, so Kamal stops them without -t: the container's own stop timeout applies.
    for (const role of ['api', 'storefront']) {
      expect(Number(roles[role]?.options?.['stop-timeout'])).toBeGreaterThanOrEqual(35);
    }
  });

  it('sets the edge client-IP settings for staging', () => {
    expect(clearOf('api')['APP_ENV']).toBe('staging');
    expect(clearOf('api')['CLIENT_IP_HEADER']).toBe('CF-Connecting-IP');
    expect(clearOf('api')['TRUSTED_PROXY_HOPS']).toBe(1);
    expect(clearOf('storefront')['STOREFRONT_TRUST_EDGE_IP']).toBe(true);
  });

  it('names secrets only, each one listed in .kamal/secrets.example', () => {
    const allSecrets = [...Object.keys(roles).flatMap(secretsOf), 'KAMAL_REGISTRY_PASSWORD'];
    allSecrets.push('ORIGIN_CA_CERTIFICATE_PEM', 'ORIGIN_CA_PRIVATE_KEY_PEM');
    for (const name of allSecrets) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(secretsFileNames).toContain(name);
    }
    for (const role of Object.keys(roles)) {
      const clearNames = Object.keys(clearOf(role));
      expect(clearNames.filter((name) => secretsOf(role).includes(name))).toEqual([]);
    }
  });

  it('hands the storefront no server secret', () => {
    expect(secretsOf('storefront').sort()).toEqual([
      'INTERNAL_HMAC_ACTIVE_KID',
      'INTERNAL_HMAC_KEYS',
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    ]);
  });

  it('keeps every secrets file line a reference to the environment, never a value', () => {
    const lines = read('.kamal/secrets.example')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    for (const line of lines) {
      const [name, value] = line.split('=');
      expect(value).toBe(`$${name ?? ''}`);
    }
  });

  it('git-ignores real secrets files but not the example', () => {
    expect(isIgnoredByGit('.kamal/secrets')).toBe(true);
    expect(isIgnoredByGit('.kamal/secrets.staging')).toBe(true);
    expect(isIgnoredByGit('.kamal/secrets-common')).toBe(true);
    expect(isIgnoredByGit('.kamal/secrets.example')).toBe(false);
  });
});

describe('Kamal pre-deploy hook (.kamal/hooks/pre-deploy)', () => {
  it('is executable', () => {
    expect(statSync(join(ROOT, '.kamal/hooks/pre-deploy')).mode & 0o111).not.toBe(0);
  });

  it('runs the new version of the migrate role once, on the primary host, before any container starts', () => {
    expect(hook).toMatch(/^set -eu$/m);
    expect(hook).toMatch(
      /kamal app exec --primary --roles=api --version="\$KAMAL_VERSION"[^\n]*'env ROLE=migrate sh \/app\/scripts\/docker-entrypoint\.sh'/,
    );
  });

  it('never traces or prints its environment, which holds every Kamal secret', () => {
    expect(hook).not.toMatch(/set -[a-z]*x/);
    expect(hook).not.toMatch(/\b(env|printenv|export -p)\s*$/m);
  });
});
