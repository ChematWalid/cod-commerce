// __ENV holds the `-e NAME=value` options: a k6 runtime global.
/* global __ENV */
import { fail } from 'k6';
import { productPath, getPage, productSlugsOf } from './lib/storefront.js';
import { summaryFiles } from './lib/summary.js';
import { storeTargetOf } from './lib/target.js';

/**
 * Constant load: a fixed arrival rate of buyer page views (home, product list, product pages) for `DURATION`.
 * Run it across a rolling deploy: a 5xx or a dropped connection during the rollout fails the run (ADR 0013 drain).
 *
 *   scripts/ops/tool.sh k6 run -e ORIGIN=… -e STORE_HOST=… -e RATE=20 -e DURATION=60s ops/k6/constant-load.js
 */
const target = storeTargetOf(__ENV);
const RATE = Number(__ENV.RATE ?? '20');
const DURATION = __ENV.DURATION ?? '60s';
const P95_MS = Number(__ENV.P95_MS ?? '1500');
const PRODUCT_POOL = 20;

if (!(RATE > 0) || !(P95_MS > 0)) throw new Error('RATE and P95_MS must be positive numbers');

export const options = {
  scenarios: {
    browse: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.max(10, RATE),
      maxVUs: Math.max(50, RATE * 5),
    },
  },
  thresholds: {
    server_errors: ['count==0'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    http_req_duration: [`p(95)<${String(P95_MS)}`],
    dropped_iterations: ['count==0'],
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const slugs = productSlugsOf(target, PRODUCT_POOL);
  if (slugs.length === 0) fail(`the store ${target.host} lists no product: constant load needs some`);
  return { slugs };
}

/** Four views in ten land on the home page, two on the list, four on a product page. */
const HOME_SHARE = 0.4;
const LIST_SHARE = 0.6;

/** @param {{ slugs: string[] }} data */
export default function view(data) {
  const roll = Math.random();
  if (roll < HOME_SHARE) return void getPage(target, '/', 'home');
  if (roll < LIST_SHARE) return void getPage(target, '/products', 'product list');
  const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)];
  getPage(target, productPath(slug), 'product page');
}

/** @param {Parameters<typeof summaryFiles>[2]} data */
export function handleSummary(data) {
  return summaryFiles(
    'constant-load',
    `k6 constant load: ${target.host}, ${String(RATE)}/s for ${DURATION}`,
    data,
    __ENV.SUMMARY_DIR,
  );
}
