// __ENV holds the `-e NAME=value` options: a k6 runtime global.
/* global __ENV */
import { fail } from 'k6';
import { productPath, getPage, productSlugsOf } from './lib/storefront.js';
import { summaryFiles } from './lib/summary.js';
import { storeTargetOf } from './lib/target.js';

/**
 * Smoke: one buyer walks the store once per iteration (readiness, home, product list, the store api, a product
 * page). Every request must answer 200; any 5xx fails the run. Run after each deploy, before warm-up.
 *
 *   scripts/ops/tool.sh k6 run -e ORIGIN=http://127.0.0.1:3000 -e STORE_HOST=demo.localhost ops/k6/smoke.js
 */
const target = storeTargetOf(__ENV);

export const options = {
  scenarios: { walk: { executor: 'shared-iterations', vus: 1, iterations: 3, maxDuration: '1m' } },
  thresholds: {
    server_errors: ['count==0'],
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<2000'],
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const slugs = productSlugsOf(target, 1);
  if (slugs.length === 0) fail(`the store ${target.host} lists no product: smoke needs one`);
  return { slug: slugs[0] };
}

/** @param {{ slug: string }} data */
export default function walk(data) {
  getPage(target, '/readyz', 'readyz');
  getPage(target, '/', 'home');
  getPage(target, '/products', 'product list');
  getPage(target, '/api/store/products?take=12', 'store api products');
  getPage(target, productPath(data.slug), 'product page');
}

/** @param {Parameters<typeof summaryFiles>[2]} data */
export function handleSummary(data) {
  return summaryFiles('smoke', `k6 smoke: ${target.host}`, data, __ENV.SUMMARY_DIR);
}
