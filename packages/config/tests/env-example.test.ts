import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { DASHBOARD_DEV_ENV_KEYS } from '../../../apps/server/src/config/dashboard-dev-api';
import { SERVER_ENV_KEYS } from '../../../apps/server/src/config/env';
import { STOREFRONT_ENV_KEYS } from '../../../apps/storefront/src/config/storefront-env';
import { composeVariables, documentedKeys, isEnvFile, missingKeys } from '../gates/env-example';

const repoRoot = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

const ROOT_EXAMPLE = '.env.example';
const SERVER_EXAMPLE = 'apps/server/.env.example';
const STOREFRONT_EXAMPLE = 'apps/storefront/.env.example';
const COMPOSE_FILE = 'docker-compose.yml';
const STOREFRONT_PACKAGE = 'apps/storefront/package.json';
/** The services that run the server image with the server's env schema. */
const SERVER_SERVICES = ['migrate', 'api', 'worker'];

/** Schema keys no `.env.example` documents. Each entry says why; a new one needs the same. */
const UNDOCUMENTED_SERVER_KEYS: Readonly<Record<string, string>> = {
  SNOWFLAKE_WORKER_ID: 'test-only: loadEnv refuses it unless APP_ENV is test (ADR 0003)',
};

/** Storefront keys compose leaves to the image. Each entry says why; a new one needs the same. */
const NOT_PASSED_TO_STOREFRONT: Readonly<Record<string, string>> = {
  NEXT_DEPLOYMENT_ID: 'the image ENV from the build arg is the only source, so cache keys match the built assets',
};

/** Schema keys compose does not hand to the server containers. Each entry says why; a new one needs the same. */
const NOT_PASSED_BY_COMPOSE: Readonly<Record<string, string>> = {
  ...UNDOCUMENTED_SERVER_KEYS,
  DEMO_OWNER_PASSWORD: 'seed:demo only: verify-stack passes it with -e to a one-off run, never to a running role',
};

interface ComposeFile {
  services: Record<string, { environment?: Record<string, string> }>;
}

function composeEnvKeys(services: readonly string[]): Set<string> {
  const compose = parse(read(COMPOSE_FILE), { merge: true }) as ComposeFile;
  return new Set(services.flatMap((service) => Object.keys(compose.services[service]?.environment ?? {})));
}

/** The variables the storefront's package scripts expand, such as the port of `next dev` and `next start`. */
function storefrontScriptVariables(): Set<string> {
  const { scripts } = JSON.parse(read(STOREFRONT_PACKAGE)) as { scripts: Record<string, string> };
  return composeVariables(Object.values(scripts).join('\n'));
}

describe('env example gate helpers', () => {
  it('reads set and commented-out keys, and skips prose comments', () => {
    const example = ['# A comment about KEY_IN_PROSE and how it is set', 'SET_KEY=1', '# OPTIONAL_KEY=', '', 'EMPTY='];

    expect([...documentedKeys(example.join('\n'))]).toEqual(['SET_KEY', 'OPTIONAL_KEY', 'EMPTY']);
  });

  it('reads lowercase keys too', () => {
    expect([...documentedKeys('lower_key=1\n# optional_lower=')]).toEqual(['lower_key', 'optional_lower']);
  });

  it('reads compose variables with defaults and nested defaults, and skips escaped ones', () => {
    const compose = 'a: ${PLAIN}\nb: ${WITH_DEFAULT:-x}\nc: ${OUTER:-http://${INNER:-y}}\nd: $${ESCAPED}';

    expect([...composeVariables(compose)]).toEqual(['PLAIN', 'WITH_DEFAULT', 'OUTER', 'INNER']);
  });

  it('reads the unbraced form', () => {
    expect([...composeVariables('a: $UNBRACED\nb: "x-$IN_TEXT-y"\nc: $_LEADING_UNDERSCORE')]).toEqual([
      'UNBRACED',
      'IN_TEXT',
      '_LEADING_UNDERSCORE',
    ]);
  });

  it('reads lowercase and mixed-case names', () => {
    expect([...composeVariables('a: ${lower_case}\nb: $mixedCase\nc: ${Mixed_1:-x}')]).toEqual([
      'lower_case',
      'mixedCase',
      'Mixed_1',
    ]);
  });

  it('skips every escaped form, and reads a variable that follows an escaped dollar', () => {
    const compose =
      'a: $$ESCAPED\nb: $${ESCAPED_BRACED}\nc: $$$AFTER_ESCAPE\nd: $$${AFTER_ESCAPE_BRACED}\ne: costs 5$ or $1';

    expect([...composeVariables(compose)]).toEqual(['AFTER_ESCAPE', 'AFTER_ESCAPE_BRACED']);
  });

  it('lists what is neither present nor exempt', () => {
    expect(missingKeys(['B', 'A', 'C', 'D'], new Set(['C']), { D: 'reason' })).toEqual(['A', 'B']);
  });

  it.each([
    '.env',
    'apps/server/.env',
    '.env.local',
    'apps/storefront/.env.production',
    'prod.env',
    'deploy/secrets.env',
    '.envrc',
    'infra/.envrc',
  ])('treats %s as an env file', (file) => {
    expect(isEnvFile(file)).toBe(true);
  });

  it.each([
    '.env.example',
    'apps/server/.env.example',
    'apps/server/src/config/env.ts',
    'auth-env.ts',
    'docs/environment.md',
    'runtime-env.d.ts',
  ])('does not treat %s as an env file', (file) => {
    expect(isEnvFile(file)).toBe(false);
  });
});

describe('.env.example completeness', () => {
  it('has something to check: a refactor that empties a key set must not pass the gate', () => {
    expect(SERVER_ENV_KEYS).toEqual(expect.arrayContaining(['DATABASE_URL', 'TRUSTED_PROXY_HOPS']));
    expect(STOREFRONT_ENV_KEYS).toContain('INTERNAL_API_URL');
    expect(DASHBOARD_DEV_ENV_KEYS).toContain('API_HOST');
    expect([...composeVariables(read(COMPOSE_FILE))]).toEqual(expect.arrayContaining(['POSTGRES_USER', 'APP_ENV']));
    expect([...composeEnvKeys(SERVER_SERVICES)]).toContain('DATABASE_URL');
    expect([...composeEnvKeys(['storefront'])]).toContain('INTERNAL_API_URL');
    expect([...storefrontScriptVariables()]).toContain('STOREFRONT_PORT');
    for (const example of [ROOT_EXAMPLE, SERVER_EXAMPLE, STOREFRONT_EXAMPLE]) {
      expect(documentedKeys(read(example)).size, example).toBeGreaterThan(0);
    }
  });

  it('documents every key of the server env schema in apps/server/.env.example', () => {
    const missing = missingKeys(SERVER_ENV_KEYS, documentedKeys(read(SERVER_EXAMPLE)), UNDOCUMENTED_SERVER_KEYS);

    expect(missing, `add to ${SERVER_EXAMPLE} with a one-line comment`).toEqual([]);
  });

  it('documents the variables of the dashboard dev server in apps/server/.env.example', () => {
    const missing = missingKeys(DASHBOARD_DEV_ENV_KEYS, documentedKeys(read(SERVER_EXAMPLE)));

    expect(missing, `add to ${SERVER_EXAMPLE} with a one-line comment`).toEqual([]);
  });

  it('documents every variable docker-compose.yml interpolates in the root .env.example', () => {
    const missing = missingKeys(composeVariables(read(COMPOSE_FILE)), documentedKeys(read(ROOT_EXAMPLE)));

    expect(missing, `add to ${ROOT_EXAMPLE} with a one-line comment`).toEqual([]);
  });

  it('hands every key of the server env schema to the server containers', () => {
    // Compose lists the environment (no env_file), so a schema key it leaves out cannot be set from .env.
    const missing = missingKeys(SERVER_ENV_KEYS, composeEnvKeys(SERVER_SERVICES), NOT_PASSED_BY_COMPOSE);

    expect(missing, `add to the x-app environment of ${COMPOSE_FILE}`).toEqual([]);
  });

  it('documents every variable the storefront reads in apps/storefront/.env.example', () => {
    const missing = missingKeys(STOREFRONT_ENV_KEYS, documentedKeys(read(STOREFRONT_EXAMPLE)));

    expect(missing, `add to ${STOREFRONT_EXAMPLE} with a one-line comment`).toEqual([]);
  });

  it('documents every variable the storefront package scripts expand in apps/storefront/.env.example', () => {
    const missing = missingKeys(storefrontScriptVariables(), documentedKeys(read(STOREFRONT_EXAMPLE)));

    expect(missing, `add to ${STOREFRONT_EXAMPLE} with a one-line comment`).toEqual([]);
  });

  it('hands every variable the storefront reads to its container', () => {
    const missing = missingKeys(STOREFRONT_ENV_KEYS, composeEnvKeys(['storefront']), NOT_PASSED_TO_STOREFRONT);

    expect(missing, `add to the storefront environment of ${COMPOSE_FILE}`).toEqual([]);
  });

  it('keeps the exemptions to keys the schemas still have', () => {
    expect(missingKeys(Object.keys(NOT_PASSED_BY_COMPOSE), new Set(SERVER_ENV_KEYS))).toEqual([]);
    expect(missingKeys(Object.keys(NOT_PASSED_TO_STOREFRONT), new Set(STOREFRONT_ENV_KEYS))).toEqual([]);
  });
});

describe('env files in git', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n');

  it('tracks no env file: no .env, .env.*, *.env or .envrc at any level', () => {
    expect(tracked.length).toBeGreaterThan(100);
    expect(tracked.filter(isEnvFile)).toEqual([]);
  });

  it('tracks the three .env.example files', () => {
    expect(tracked).toEqual(expect.arrayContaining([ROOT_EXAMPLE, SERVER_EXAMPLE, STOREFRONT_EXAMPLE]));
  });

  it.each(['.env', 'apps/server/.env.local', 'prod.env', 'deploy/secrets.env', '.envrc'])('git ignores %s', (file) => {
    const ignored = execFileSync('git', ['check-ignore', file], { cwd: repoRoot, encoding: 'utf8' });

    expect(ignored.trim()).toBe(file);
  });
});
