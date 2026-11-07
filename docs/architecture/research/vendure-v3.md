# Vendure v3 research notes (as of 2026-11-07; latest = v3.8.0, released 2026-10-12)

Source key: D = https://docs.vendure.io ; G = https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs . "UNVERIFIED" = not found in official docs.

## 1. Deployment / process model
- Server = `bootstrap(config)`; worker = `bootstrapWorker(config)` then `worker.startJobQueue()`. Worker is a NestJS standalone app with no network listener, same config as server. Running job queue on the server via `JobQueueService.start()` is discouraged in production. Use `ProcessContext` (`isServer`/`isWorker`) to branch plugin behaviour. https://docs.vendure.io/guides/developer-guide/worker-job-queue/
- Both server and worker scale horizontally. Server adds API throughput, worker adds job parallelism. All state must live outside the Node process (DB, Redis, S3). With cookie sessions all instances need the same `authOptions.cookieOptions.secret`. https://docs.vendure.io/guides/deployment/horizontal-scaling/
- Docker guide: one image, two commands (`start:server`, `start:worker`); worker publishes no port. Kubernetes example runs both as containers. https://docs.vendure.io/current/core/guides/deployment/using-docker.md
- Health: REST `/health` returns `{status:"ok"}` unconditionally. Since v3.6.0 the `systemOptions.healthChecks` strategies (incl. `TypeORMHealthCheckStrategy`) NO LONGER RUN; strategy classes and `HealthCheckRegistryService` removed in v4.0.0; set `healthChecks: []`. Worker health: `startHealthCheckServer({ port })` (per Docker guide). Monitor DB/Redis separately. https://docs.vendure.io/current/core/core-concepts/healthchecks.md
- Production config: `apiOptions.trustProxy` behind LB, `apiOptions.cors` restricted, `@vendure/harden-plugin` (`HardenPlugin.init({maxQueryComplexity, apiMode})`), `UuidIdStrategy` optional, DB in UTC, strong `superadminCredentials`. https://docs.vendure.io/guides/deployment/production-configuration/

## 2. Job queue
- Default (no plugin) = `InMemoryJobQueueStrategy` (dev only, cannot serve a separate worker). `DefaultJobQueuePlugin` = `SqlJobQueueStrategy`, DB polling, 200ms default per queue. `BullMQJobQueuePlugin` (Redis, push-based) is documented as "much more efficient" and recommended for production/many queues. https://docs.vendure.io/guides/developer-guide/worker-job-queue/ , https://docs.vendure.io/guides/deployment/horizontal-scaling/
- BullMQ options (`BullMQPluginOptions`): `connection`, `queueOptions`, `workerOptions`, `concurrency` (number or `(queueName)=>number`, default 3; queues returning same value share a worker), `setRetries(queueName, job)`, `setBackoff(queueName, job)` (default exponential/1000ms), `setJobOptions(queueName, job)` (since v3.2.0; returns BullMQ `JobsOptions`, so `priority`, `delay`, `attempts` are possible). Redis key prefix via `prefix` in queueOptions/workerOptions (no `queueNamePrefix` option found - UNVERIFIED name). https://docs.vendure.io/current/core/reference/core-plugins/job-queue-plugin/bull-mqplugin-options.md
- Queue naming: `JobQueueService.createQueue({ name, process })`; `JobQueue.add(data, { retries })`. `JobQueueOptions.activeQueues` dedicates a worker to specific queues. Job data must be JSON-serializable; serialize RequestContext with `ctx.serialize()`/`RequestContext.deserialize()` (large; strains Redis). Large payloads bloat Redis memory.
- Scheduled tasks: built-in scheduler since v3.3. Needs `DefaultSchedulerPlugin` (adds a DB table = migration). `ScheduledTask({ id, description, schedule: cron => cron.everyDayAt(0,0), params, execute })`, registered in `schedulerOptions.tasks` or by plugins; `timezone` per task added v3.8. Runs only on workers, locked so each tick runs once across instances. `cleanSessionsTask` default. Only last result stored. https://docs.vendure.io/current/core/developer-guide/scheduled-tasks.md , https://docs.vendure.io/current/core/reference/typescript-api/scheduled-tasks/default-scheduler-plugin.md
- Per-tenant fairness / per-tenant queues: not documented (UNVERIFIED).

## 3. Caching and sessions
- Pre-3.1: default session cache was in-memory, needed custom `SessionCacheStrategy`. From v3.1: `DefaultSessionCacheStrategy` uses the configured `CacheStrategy`; custom via `authOptions.sessionCacheStrategy`. https://docs.vendure.io/guides/deployment/horizontal-scaling/ , https://docs.vendure.io/current/core/developer-guide/cache.md
- v3 cache system: `CacheService` (TTL, tags, invalidation), backends `DefaultCachePlugin` (DB, `cacheSize` default 10000, needs migration, default in new projects since v3.1) and `RedisCachePlugin`. Without a plugin the cache is in-memory and not shared (dev only). Also `RequestContextCacheService` (per request), `SelfRefreshingCache`. No built-in generic "entity cache"; documented pattern is `createCache` keyed by entity ID + event invalidation.
- Channel and Zone data cached in memory, TTL default 30s, `EntityOptions.channelCacheTtl`. (horizontal-scaling page above)

## 4. Assets
- `AssetServerPlugin.init({ route, assetUploadDir, assetUrlPrefix, namingStrategy, storageStrategyFactory })`; S3 via `configureS3AssetStorage({ bucket, credentials, nativeS3Configuration:{endpoint, region, forcePathStyle} })` (works with MinIO/R2/etc). CDN: set `assetUrlPrefix` to CDN URL. https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/how-to/s3-asset-storage/index.mdx
- Image transforms (preset/size query params) are done by the asset server (sharp) on request and cached; check specifics - UNVERIFIED here. Put CDN in front for caching transforms.
- Assets are channel-aware entities, but S3 keys are not tenant-prefixed by default; use custom `AssetNamingStrategy`/storage strategy for per-tenant prefixes (inference).

## 5. Search
- `DefaultSearchPlugin`: SQL on a search-index table, strategies `PostgresSearchStrategy`/`MysqlSearchStrategy`/`SqliteSearchStrategy`, options `indexStockStatus`, `indexCurrencyCode`, `bufferUpdates`, `searchStrategy`. Fine for small/medium catalogs. https://docs.vendure.io/current/core/core-concepts/search.md
- Elasticsearch moved to community: `@vendure-community/elasticsearch-plugin` (https://github.com/vendurehq/community-plugins). Same GraphQL search schema, drop-in.
- Typesense: official but paid "Advanced Search Plugin" (Vendure Platform licence) https://vendure.io/plugins/vendure-plus-advanced-search-plugin ; Meilisearch: third party `@rahul_vendure/vendure-meilli-search` v1.0.1, maintenance unknown.
- Multi-language: index is per language/channel (Vendure translations); Arabic-specific tokenisation/stemming for Postgres default strategy: UNVERIFIED (default uses ILIKE/tsvector-style SQL; test Arabic normalization). Dashboard has RTL flag (see 7).

## 6. Channels / multi-tenancy
- Channels = multi-tenancy, multivendor, region stores. Docs explicitly list "Multi-tenancy: one channel per shop with its own products, shipping/payment methods; storefronts target their channel; default channel kept for superadmin." Channel-aware: Asset, Collection, Customer, Facet, FacetValue, Order, PaymentMethod, Product, ProductVariant, Promotion, Role, ShippingMethod, StockLocation. Channel selected by `vendure-token` header. Each channel has one `Seller`. https://docs.vendure.io/current/core/core-concepts/channels.md
- Default channel contains ALL entities (every entity of every tenant also joined to default channel; join tables grow). Prices on `ProductVariantPrice` per channel/currency.
- Multi-vendor: strategies `OrderSellerStrategy`, `ShippingLineAssignmentStrategy`; sellers each get a channel. https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/how-to/multi-vendor-marketplaces/index.mdx
- Limits for thousands of channels: NOT documented. No official numbers found (UNVERIFIED). Channel data is cached in memory (30s TTL). Customers are channel-aware but a customer can span channels; Administrators/Roles scoped to channels. Must load-test channel-join queries.

## 7. React dashboard (`@vendure/dashboard`)
- Replaces Angular Admin UI since v3.5.0; Angular UI unmaintained after July 2026 (security/critical fixes only until then) - i.e. effectively end-of-life now. https://docs.vendure.io/current/core/extending-the-dashboard/migration.md ; https://docs.vendure.io/current/core/reference/core-plugins/admin-ui-plugin
- Extensions: plugin metadata `dashboard: './dashboard/index.tsx'`, entry calls `defineDashboardExtension` (since 3.3.0) with keys `routes`, `pageBlocks`, `navSections`, `actionBarItems`, `alerts`, `widgets` (Insights page), `customFormComponents`, `dataTables`, `detailForms`, `login`, `historyEntries`, `toolbarItems`. Scaffold: `npx vendure add --dashboard <Plugin>`. https://docs.vendure.io/guides/extending-the-dashboard/extending-overview
- Nav: custom sections with `placement: 'top'|'bottom'` and `order`; routes attach via `navMenuItem.sectionId`. `navSections` can be a function receiving and returning the nav config (since 3.6.0), enabling reorganise/replace of built-in sections. https://docs.vendure.io/reference/dashboard/extensions-api/define-dashboard-extension ; G/guides/extending-the-dashboard/navigation/index.mdx
- i18n: Lingui; `lingui.config.js` catalogs per plugin, `npx lingui extract`, `.po` files; dashboard locale list built from `defaultAvailableLanguages`. `useDisplayLocale()` returns `isRTL`. RTL layout completeness for Arabic: UNVERIFIED (hook exists; test). G/guides/extending-the-dashboard/localization/index.mdx
- Build: Vite with `vendureDashboardPlugin({ vendureConfigPath, api:{host,port}, gqlOutputPath })`, `base` must equal plugin `route`. Served by `DashboardPlugin.init({ route, appDir })` or hosted fully standalone as static site (Netlify/Vercel/S3) with CORS; env vars baked at build. https://docs.vendure.io/guides/extending-the-dashboard/deployment ; G/guides/extending-the-dashboard/getting-started/index.mdx
- Dashboard is built by scanning your VendureConfig, so plugins' dashboard code is compiled into one build (per-tenant branding/dashboards would need runtime logic).

## 8. Distribution, versioning, licence
- Scaffold `npx @vendure/create my-app`; app depends on published `@vendure/*` npm packages (core, asset-server-plugin, dashboard, ...). Update all `@vendure/*` to same version. https://docs.vendure.io/current/core/developer-guide/updating
- Cadence: 3.7.0 on 2026-07-01, 3.8.0 on 2026-10-12, patches in between (~quarterly minors - inferred). SemVer "generally", but 3.8.0 had breaking items (order-line promotion data migration, NestJS 12, Apollo Server 5, `ctx.session.token` type). Core still on `typeorm ^0.3.21`; TypeORM v1 opt-in from 3.8. https://docs.vendure.io/changelog?focus=v3.8.0
- Licence: GPLv3 OR Vendure Commercial License (VCL, separate written agreement with Vendure GmbH). Modifications to the framework must be GPLv3. `plugin-exception.txt` lets plugins be distributed under another licence; writing a plugin does not force GPL. FAQ says viewing a website is not "distribution" (no source-sharing for hosted use, GPLv3 not AGPL) but gives no legal advice; get counsel. https://raw.githubusercontent.com/vendurehq/vendure/HEAD/license/license-faq.md
- Implication: stay on published packages + plugins; avoid forking core. Commercial licence / Vendure Platform plugins (Typesense search etc.) are paid.

## 9. Database
- TypeORM 0.3.x (opt-in v1 in 3.8). Production: `dbConnectionOptions.synchronize: false`; `npx vendure migrate --generate <name>` / `--run`; programmatic `generateMigration`, `runMigrations`. Custom fields and many plugin entities (scheduler, cache) require migrations. https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/developer-guide/migrations/index.mdx
- Read replicas: `RequestContext.setReplicationMode('master'|'slave'...)` and `TransactionalConnection.getRepository(ctx, Entity, { replicationMode })` exist; underlying TypeORM `replication` config in `dbConnectionOptions`. Exact value names and behaviour: check reference (UNVERIFIED). https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/reference/typescript-api/request/request-context.mdx
- Supported Postgres versions, PgBouncer/transaction-mode compatibility: NOT found in official docs (UNVERIFIED). General knowledge: transaction pooling breaks session features (advisory locks, prepared statements, LISTEN); validate before use. Scheduler/cache/job queue use DB so test with pooler.
- DB timezone must be UTC (production-configuration page).

## 10. Orders
- `orderOptions.process: [defaultOrderProcess, customProcess]` with `OrderProcess<'NewState'>` transitions + declare-module state typing; same for `PaymentProcess`. `OrderPlacedStrategy.shouldSetAsPlaced(ctx, from, to, order)` via `orderOptions.orderPlacedStrategy` (default: ArrangingPayment -> PaymentAuthorized|PaymentSettled). `OrderCodeStrategy.generate(ctx)` can be async and has `init(injector)` - ctx exposes channel, so per-business numbering is feasible. `OrderItemPriceCalculationStrategy.calculateUnitPrice(ctx, productVariant, customFields)` returns `{price, priceIncludesTax}`; line custom fields can carry a signed quote token. COD/manual: write a `PaymentMethodHandler` whose `createPayment` returns state `Authorized` (or custom state), `settlePayment` later. `FulfillmentHandler.createFulfillment`. https://github.com/vendurehq/vendure/blob/v3.8.0/docs/docs/guides/core-concepts/payment/index.mdx , .../guides/how-to/configurable-products/index.mdx
- Note: in the v3.8 doc snippet the strategy reads `productVariant.listPrice` (check signature when implementing; UNVERIFIED across versions).

## 11. Telemetry
- `@vendure/telemetry-plugin` (OpenTelemetry) since v3.3; SDK must be preloaded (`--require`). v3.7 breaking: stable semantic conventions only (attribute names changed); custom `instrumentations` replace, not merge, the defaults. https://docs.vendure.io/current/core/how-to/telemetry.md , https://docs.vendure.io/current/core/reference/core-plugins/telemetry-plugin.md

## 12. Official deployment guides
- Index: production-configuration, server-resource-requirements, horizontal-scaling, using-docker, getting-data-into-production, deploying-admin-ui; managed: Northflank, DigitalOcean App Platform, Railway, Render, Google Cloud Run. No ranking. https://docs.vendure.io/guides/deployment/

## Implications for our design
1. Run `server` (API only) and `worker` as separate processes/containers from one image; scale both horizontally; stateless behind LB.
2. Mandatory shared infra from day one: Postgres, Redis (BullMQ + `RedisCachePlugin`), S3-compatible storage + CDN via `assetUrlPrefix`. Same cookie secret on all instances.
3. Do not rely on `/health` for dependency checks since 3.6; add our own readiness probe plugin (DB/Redis) and worker health via `startHealthCheckServer`.
4. Tenant = Channel (+Seller) is the documented multi-tenancy model, but scaling to thousands of channels is unproven; load test default-channel joins, channel cache, and customer/role queries early; keep tenant data in our own plugin tables keyed by channelId where Vendure entities don't fit.
5. Per-business order numbers via `OrderCodeStrategy` (channel from ctx); COD via custom `PaymentMethodHandler`; pre-signed quote via line custom field + `OrderItemPriceCalculationStrategy`.
6. Dashboard: React only (Angular EOL). Build one dashboard from plugin extensions; use `navSections` function form to restructure nav; verify Arabic RTL and write Lingui `.po` for ar. Can be deployed as static site separate from API.
7. Search: start with `DefaultSearchPlugin` (Postgres); Arabic quality needs a spike; Elasticsearch community plugin is the supported scale-up path.
8. Ship as plugins on published `@vendure/*` packages (plugin exception covers our plugin licence); never patch core. Pin versions, budget for minor-release breaking changes (3.8 had several), run migrations as a separate deploy step with `synchronize:false`.
9. Avoid PgBouncer transaction mode until tested; replication mode APIs exist for read replicas.
10. Add `@vendure/telemetry-plugin` + OTel collector; pin OTel config because 3.7 changed attribute names.
