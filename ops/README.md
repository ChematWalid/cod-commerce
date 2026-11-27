# Ops as code: dashboards, alert rules, load scripts

| Path | What |
|---|---|
| `grafana/dashboards/` | The ADR 0015 dashboards this phase can feed: **Is buying working?**, **Queues**, **Data tier** (Grafana JSON, import format). "Are parcels moving?" waits for the carrier metrics (P4). |
| `alerts/rules.yml` | Alert rules (Prometheus rule format) with levels `page` / `notify`; `rules.test.yml` holds promtool unit tests. |
| `k6/` | Smoke, constant-load and flash-sale scripts and the warm-up (`k6/README.md`). |

Every metric name in a dashboard or a rule is the Prometheus name Grafana Cloud stores for what the code and the
node collector export (OTLP → Prometheus: dots become `_`, unit words such as `_seconds` / `_bytes` and `_total`
are appended). `packages/config/tests/ops-observability.test.ts` checks each one against the platform gauges
(`plugins/platform-metrics`), the instrumentations `@vendure/telemetry-plugin` registers and the collector
receivers (`otel/collector.yaml`), and fails on any name nothing emits.

```sh
scripts/ops/alerts-check.sh    # promtool check rules + test rules (pinned prom/prometheus image)
scripts/ops/otel-validate.sh   # the collector config the metrics come from
```

## Where the signals come from

| Signal | Source | Prometheus names |
|---|---|---|
| API rate, errors, latency per route | `@opentelemetry/instrumentation-http` in the api (`job="cod/cod-api"`) | `http_server_request_duration_seconds_{bucket,count,sum}` |
| Event-loop delay, heap per role | `@opentelemetry/instrumentation-runtime-node` | `nodejs_eventloop_delay_p99_seconds`, `v8js_memory_heap_used_bytes` |
| Outbox, scheduler, queues, intake spool | `plugins/platform-metrics` on the worker (`job="cod/cod-worker"`) | `outbox_pending`, `outbox_oldest_age_seconds`, `scheduler_task_last_success_age_seconds`, `queue_pool_jobs`, `queue_jobs`, `queue_oldest_waiting_age_seconds`, `intake_spool_length` |
| Each role's `/readyz` | collector `httpcheck/readyz` receiver, every 30 s on the node | `httpcheck_status{http_url, http_status_class}` |
| Valkey | collector `redis` receiver (`redis.maxmemory` switched on) | `redis_memory_used_bytes`, `redis_maxmemory_bytes`, `redis_keyspace_*_total`, … |
| Postgres | collector `postgresql` receiver | `postgresql_backends`, `postgresql_connection_max`, `postgresql_commits_total`, … |

Not yet a metric: the storefront's own request rate (it exports traces only; its availability comes from
Cloudflare analytics and the uptime check), intake/quote counters (P3.S4), carrier and CAPI counters (P4),
node CPU/memory/disk (node exporter, Ansible, P3.S5b). Per-statement DB time is `scripts/ops/slow-queries.sh`.

## Import into Grafana Cloud (P3.S5b, needs the account)

1. **Collector**: deploy `otel/collector.yaml` + `otel/collector.grafana.yaml` on the node with
   `GRAFANA_OTLP_ENDPOINT` / `GRAFANA_OTLP_AUTH` and the three `COLLECTOR_*_READYZ_URL` targets (the node-internal
   readiness URLs of api, worker and storefront). Check in Explore that `outbox_pending` and
   `httpcheck_status` arrive, with `job="cod/cod-worker"` on the gauges.
2. **Dashboards**: Dashboards → New → Import → upload each JSON from `grafana/dashboards/`; pick the stack's
   Prometheus data source (`grafanacloud-<stack>-prom`) for `DS_PROMETHEUS`. The uids are fixed
   (`cod-is-buying-working`, `cod-queues`, `cod-data-tier`), so a re-import replaces instead of duplicating.
3. **Alert rules**: load `alerts/rules.yml` as data-source-managed rules into the stack's Mimir with
   `mimirtool rules load --address=<prometheus url> --id=<stack id> --key=<access policy token, rules:write> ops/alerts/rules.yml`
   (pin a `grafana/mimirtool` image in `scripts/ops/tool.sh` first; the token never goes in the repo), or recreate
   them as Grafana-managed rules with the same expressions, labels and annotations.
4. **Contact points and policy**:
   - contact points: Telegram (with sound) for paging, an email or channel for notifications;
   - root policy → `notify`; child policy `severity=page` → Telegram;
   - a nested policy `page_hours=daytime` with a mute timing 23:00–08:00 `Africa/Algiers` on the Telegram route and
     `continue` to the notify route, so outbox lag and webhook backlog notify at night and page by day (ADR 0015).
5. Fire one test: stop the worker on staging for 11 min and expect `WorkerAbsent` on Telegram; start it again and
   expect the resolve.

## Uptime check (choice pending, P3.S5b)

The public check probes the edge: `/api/readyz` of the storefront node, one store page and (from P3.S4) order
intake on the synthetic test store. Shortlist, to be picked when staging exists (ADR 0015):

| Tool | For | Against |
|---|---|---|
| Grafana Synthetic Monitoring | same stack as metrics and alerting, results are metrics the rules can read | free-tier execution budget limits the probe frequency and locations |
| UptimeRobot | simple, free monitors at 5 min | separate alerting path, coarse interval |
| Better Stack Uptime | status page included, free tier with short intervals | another account and alerting path |
| Healthchecks.io | heartbeat ("dead man's switch") for the nightly dump and the monthly restore test | not an HTTP prober |

Check each tool's current free-tier limits at selection time; record the choice as a decision row.
