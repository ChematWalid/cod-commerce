import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const K6 = join(repoRoot, 'ops/k6');
const WARM_UP = join(repoRoot, 'scripts/ops/warm-up.sh');
const SCRIPTS = ['smoke.js', 'constant-load.js', 'flash-sale.js'] as const;

interface StoreTarget {
  readonly origin: string;
  readonly host: string;
}
interface TargetLib {
  readonly storeTargetOf: (env: Readonly<Record<string, string | undefined>>) => StoreTarget;
}
interface IntakeLib {
  readonly isIntakePending: (status: number) => boolean;
}
interface SummaryLib {
  readonly renderSummary: (title: string, data: unknown) => string;
  readonly summaryFiles: (
    name: string,
    title: string,
    data: unknown,
    dir: string | undefined,
  ) => Record<string, string>;
}

// The k6 helpers are plain ES modules without k6 imports, loaded by path so this program needs no declarations.
const load = async <T>(file: string): Promise<T> => (await import(join(K6, 'lib', file))) as T;
const read = (file: string): string => readFileSync(join(K6, file), 'utf8');

/** A k6 end-of-test summary as `handleSummary` receives it, trimmed to what the renderer reads. */
const SUMMARY_DATA = {
  setup_data: { pending: false },
  metrics: {
    http_reqs: { type: 'counter', values: { count: 1200, rate: 20 } },
    http_req_failed: { type: 'rate', values: { rate: 0 }, thresholds: { 'rate<0.01': { ok: true } } },
    checks: { type: 'rate', values: { rate: 1 } },
    http_req_duration: {
      type: 'trend',
      values: { med: 41.2, 'p(95)': 180.6, 'p(99)': 310.1, max: 402.9 },
      thresholds: { 'p(95)<1500': { ok: true } },
    },
    server_errors: { type: 'counter', values: { count: 2, rate: 0.03 }, thresholds: { 'count==0': { ok: false } } },
  },
};

describe('ops/k6 store target', () => {
  it('defaults to the local storefront and the demo store', async () => {
    const { storeTargetOf } = await load<TargetLib>('target.js');

    expect(storeTargetOf({})).toEqual({ origin: 'http://127.0.0.1:3000', host: 'demo.localhost' });
  });

  it('reads the origin and the store host from the environment', async () => {
    const { storeTargetOf } = await load<TargetLib>('target.js');

    const target = storeTargetOf({ ORIGIN: 'https://staging-node.example.test:8443', STORE_HOST: 'shop.example.test' });

    expect(target).toEqual({ origin: 'https://staging-node.example.test:8443', host: 'shop.example.test' });
  });

  it.each([
    ['an origin with a path', { ORIGIN: 'http://127.0.0.1:3000/store' }],
    ['an origin without a scheme', { ORIGIN: '127.0.0.1:3000' }],
    ['a store host with a scheme', { STORE_HOST: 'http://demo.localhost' }],
    ['a store host with a path', { STORE_HOST: 'demo.localhost/store' }],
  ])('refuses %s', async (_case, env) => {
    const { storeTargetOf } = await load<TargetLib>('target.js');

    expect(() => storeTargetOf(env)).toThrow(/ORIGIN|STORE_HOST/);
  });
});

describe('ops/k6 flash-sale intake probe', () => {
  it.each([404, 405])('reads %i as the intake route not deployed yet (P3.S4 pending)', async (status) => {
    const { isIntakePending } = await load<IntakeLib>('intake.js');

    expect(isIntakePending(status)).toBe(true);
  });

  it.each([200, 202, 400, 409, 429, 500])('reads %i as a live intake route', async (status) => {
    const { isIntakePending } = await load<IntakeLib>('intake.js');

    expect(isIntakePending(status)).toBe(false);
  });
});

describe('ops/k6 summary', () => {
  it('renders the request count, latency percentiles and 5xx count', async () => {
    const { renderSummary } = await load<SummaryLib>('summary.js');

    const markdown = renderSummary('Constant load', SUMMARY_DATA);

    expect(markdown).toContain('# Constant load');
    expect(markdown).toMatch(/\| http_reqs \| count 1200, rate 20\.00\/s \|/);
    expect(markdown).toMatch(/\| http_req_duration \| .*p\(95\) 180\.6 ms.*\|/);
    expect(markdown).toMatch(/\| server_errors \| count 2, /);
  });

  it('gives each threshold its verdict', async () => {
    const { renderSummary } = await load<SummaryLib>('summary.js');

    const markdown = renderSummary('Constant load', SUMMARY_DATA);

    expect(markdown).toContain('| server_errors | `count==0` | FAILED |');
    expect(markdown).toContain('| http_req_duration | `p(95)<1500` | passed |');
  });

  it('says when the scenario was skipped because its route is pending', async () => {
    const { renderSummary } = await load<SummaryLib>('summary.js');

    const markdown = renderSummary('Flash sale', {
      ...SUMMARY_DATA,
      setup_data: { pending: true, probeStatus: 404 },
    });

    expect(markdown).toMatch(/PENDING.*404/);
  });

  it('writes markdown and json files only when a summary directory is given', async () => {
    const { summaryFiles } = await load<SummaryLib>('summary.js');

    const withDir = summaryFiles('smoke', 'Smoke', SUMMARY_DATA, 'docs/evidence/P3.S5a/k6');
    const withoutDir = summaryFiles('smoke', 'Smoke', SUMMARY_DATA, undefined);

    expect(Object.keys(withDir).sort()).toEqual([
      'docs/evidence/P3.S5a/k6/smoke.json',
      'docs/evidence/P3.S5a/k6/smoke.md',
      'stdout',
    ]);
    expect(Object.keys(withoutDir)).toEqual(['stdout']);
  });
});

describe('ops/k6 scripts', () => {
  it.each(SCRIPTS)('%s fails the run on any 5xx', (file) => {
    expect(read(file)).toMatch(/server_errors:\s*\[\s*'count==0'\s*\]/);
  });

  it.each(SCRIPTS)('%s writes its summary through the shared renderer', (file) => {
    expect(read(file)).toMatch(/export function handleSummary/);
    expect(read(file)).toContain("from './lib/summary.js'");
  });

  it.each(SCRIPTS)('%s never calls the internal api routes', (file) => {
    expect(read(file)).not.toMatch(/['`]\/(store|_internal|_t)\//);
  });

  it('flash-sale refuses to run unless the store is declared synthetic', () => {
    expect(read('flash-sale.js')).toMatch(/SYNTHETIC_STORE/);
  });
});

/** The storefront as warm-up sees it: one store host, a product list, product pages; one slug can fail. */
interface StubStore {
  readonly server: Server;
  readonly requests: Array<{ path: string; host: string | undefined }>;
  origin(): string;
}

function stubStorefront(slugs: readonly string[], failingSlug?: string): StubStore {
  const requests: StubStore['requests'] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = request.url ?? '/';
    requests.push({ path, host: request.headers.host });
    if (request.headers.host?.split(':')[0] !== 'demo.localhost') return void response.writeHead(404).end();
    if (path.startsWith('/api/store/products?')) {
      const take = Number(new URL(path, 'http://stub').searchParams.get('take'));
      const items = slugs.slice(0, take).map((slug, index) => ({ id: String(index + 1), slug }));
      response.writeHead(200, { 'Content-Type': 'application/json' });
      return void response.end(JSON.stringify({ items, totalItems: slugs.length, skip: 0, take }));
    }
    if (failingSlug !== undefined && path === `/product/${encodeURIComponent(failingSlug)}`) {
      return void response.writeHead(500).end();
    }
    if (path === '/' || path.startsWith('/product/')) return void response.writeHead(200).end('<html></html>');
    response.writeHead(404).end();
  });
  return {
    server,
    requests,
    origin: () => `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
  };
}

interface WarmUpRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function warmUp(env: Record<string, string>): Promise<WarmUpRun> {
  return new Promise((done) => {
    execFile(
      'bash',
      [WARM_UP],
      { env: { PATH: process.env['PATH'], ...env }, cwd: repoRoot },
      (error, stdout, stderr) => {
        done({ code: typeof error?.code === 'number' ? error.code : 0, stdout, stderr });
      },
    );
  });
}

describe('scripts/ops/warm-up.sh', () => {
  let stub: StubStore;

  afterEach(() => {
    stub.server.close();
  });

  describe('against a healthy store', () => {
    beforeEach(async () => {
      stub = stubStorefront(['robe-kabyle', 'جبة', 'tapis', 'lampe']);
      await new Promise<void>((ready) => stub.server.listen(0, '127.0.0.1', ready));
    });

    it('requests the home page, then the top-N product pages from the store api, as the store host', async () => {
      const run = await warmUp({ WARMUP_ORIGIN: stub.origin(), WARMUP_HOSTS: 'demo.localhost', WARMUP_TOP_N: '3' });

      expect(run.code).toBe(0);
      expect(stub.requests.map(({ path }) => path)).toEqual([
        '/',
        '/api/store/products?take=3',
        '/product/robe-kabyle',
        `/product/${encodeURIComponent('جبة')}`,
        '/product/tapis',
      ]);
      expect(stub.requests.every(({ host }) => host === 'demo.localhost')).toBe(true);
    });

    it('never calls the api routes the edge blocks', async () => {
      await warmUp({ WARMUP_ORIGIN: stub.origin(), WARMUP_HOSTS: 'demo.localhost' });

      expect(stub.requests.some(({ path }) => /^\/(store|_internal|_t)\//.test(path))).toBe(false);
    });

    it('fails when a store host is unknown to the storefront', async () => {
      const run = await warmUp({ WARMUP_ORIGIN: stub.origin(), WARMUP_HOSTS: 'demo.localhost nope.localhost' });

      expect(run.code).toBe(1);
      expect(run.stderr).toContain('nope.localhost');
    });
  });

  it('fails and names the page when a product page answers 5xx', async () => {
    stub = stubStorefront(['robe-kabyle', 'tapis'], 'tapis');
    await new Promise<void>((ready) => stub.server.listen(0, '127.0.0.1', ready));

    const run = await warmUp({ WARMUP_ORIGIN: stub.origin(), WARMUP_HOSTS: 'demo.localhost' });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('/product/tapis');
  });

  it('refuses to start without a store host', async () => {
    stub = stubStorefront([]);
    await new Promise<void>((ready) => stub.server.listen(0, '127.0.0.1', ready));

    const run = await warmUp({ WARMUP_ORIGIN: stub.origin() });

    expect(run.code).toBe(64);
    expect(run.stderr).toContain('WARMUP_HOSTS');
  });
});
