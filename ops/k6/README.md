# k6 load scripts and the warm-up

Load and smoke checks of the storefront, run from the pinned `grafana/k6` image through `scripts/ops/tool.sh k6`
(D3503; nothing is installed on the host). Every script reaches the storefront **directly** (`ORIGIN`, a node or
the local compose port) and sends the store host in `Host` (`STORE_HOST`), so the store resolves exactly as behind
Cloudflare while the CDN and its rate limits stay out of the measurement. No script calls the api's `/store/*`,
`/_internal/*` or `/_t/*` routes; the product list comes from the storefront's same-origin `/api/store/products`.

| Script | What it does | Fails the run on |
|---|---|---|
| `smoke.js` | 1 VU, 3 walks: `/readyz`, home, `/products`, `/api/store/products`, one product page | any non-200, any 5xx, p95 ≥ 2 s |
| `constant-load.js` | `RATE` page views/s (default 20) for `DURATION` (default `60s`): 40 % home, 20 % list, 40 % product pages | any 5xx or dropped connection, > 1 % failed, p95 ≥ `P95_MS` (1500), a dropped iteration |
| `flash-sale.js` | one store, one hot product, a burst to `PEAK` submits/s (default 50) held `HOLD` (20 s): cart quote then order intake | any 5xx, any intake answer other than 200/201/202, intake p95 ≥ 2 s |

`server_errors` counts 5xx answers and transport failures (status 0); every script requires it to stay at 0.
Run `constant-load.js` across a rolling deploy to prove the drain (ADR 0013): the rollout must add no 5xx.

**Flash sale is pending until P3.S4.** It probes `POST /api/store/orders`; while that answers 404/405 it sends no
submit and its summary says `PENDING`. Its cart-quote and intake bodies (`lib/intake.js`) follow the P3.S3/P3.S4
briefs and are checked against the real schemas when P3.S4 lands. Every submit creates an order, so it refuses to
start without `SYNTHETIC_STORE=1`: run it only against a synthetic test store. Lock waits (ADR 0009 addendum) are
read from Postgres during the run (`pg_stat_statements`, `pg_locks`), not by k6.

## Running

```sh
# against the local storefront (pnpm dev, demo seed)
TOOL_NETWORK=host scripts/ops/tool.sh k6 run -e ORIGIN=http://127.0.0.1:3000 -e STORE_HOST=demo.localhost ops/k6/smoke.js
TOOL_NETWORK=host scripts/ops/tool.sh k6 run -e RATE=20 -e DURATION=60s ops/k6/constant-load.js
TOOL_NETWORK=host scripts/ops/tool.sh k6 run -e SYNTHETIC_STORE=1 ops/k6/flash-sale.js

# the evidence run: own compose stack, warm-up + all three scripts, summaries in docs/evidence/P3.S5a/k6/
flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/k6-check.sh
```

`SUMMARY_DIR=<dir>` makes a script write `<dir>/<name>.md` and `<dir>/<name>.json` beside its stdout summary
(`lib/summary.js`). The pure helpers in `lib/` (target, intake, summary) are unit-tested by
`packages/config/tests/k6-scripts.test.ts`; `lib/storefront.js` holds the k6 request helpers.

## Warm-up

`scripts/ops/warm-up.sh` runs after a deploy's smoke: for each store host, the home page, then its top-N listed
products (newest first; no popularity signal exists yet), each as that host against the storefront origin.

```sh
WARMUP_HOSTS="demo.localhost second.localhost" WARMUP_ORIGIN=http://127.0.0.1:3000 WARMUP_TOP_N=10 scripts/ops/warm-up.sh
```

It exits 1 when any page does not answer 200 (and 64 without `WARMUP_HOSTS`), naming the host and path.
