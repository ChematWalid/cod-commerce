# Provenance of the cache handlers

The cache handlers in this folder are adapted from an example in the Next.js repository.

- **Upstream:** <https://github.com/vercel/next.js>, path `examples/cache-handler-redis/`
  - `cache-handler.js` (git blob `7faba1aa1f03ebf0d2b645e8c86bbcdf1512d976`) → `isr-cache-handler.ts`, `isr-serialization.ts`, `redis-connection.ts`
  - `remote-cache-handler.js` (git blob `cdb9864b4558c2f1d3dbaabf9d46572e9a9957fb`) → `use-cache-handler.ts`, `redis-connection.ts`
- **Version:** tag `v16.4.5` (commit `4e5335a00314be7fbb2aace5e9be56a88e64e5a8`), the `next` version the storefront pins. The blobs were also unchanged on `canary` on 2026-11-08.
- **Via:** spike F of P0.S2a-3 (`~/scratch/p0s2a3/spike-f/app/handlers/next-example-dpl/{isr,use-cache}.js`, outside the repo), which copied the example and prefixed the ISR keys with the deployment id. ADR 0006 records the spike and the choice.

## Licence

The Next.js repository, and so the example, is under the MIT licence:

> The MIT License (MIT)
>
> Copyright (c) 2025 Vercel, Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Our changes

1. **TypeScript, compiled to CommonJS** (`cache/*.ts` → `cache/dist/*.js` by `pnpm build:cache`), erasable syntax only; split into one module per concern (constants, config, keys, connection, serialisation, two handlers).
2. **Keys** (ADR 0006 D4): entries are `next:{deploymentId}:isr:{key}` and `next:{deploymentId}:uc:{key}` (upstream: `nextjs:cache:{key}` and `nextjs:use-cache:{key}`). The deployment prefix is the spike F (d) fix: the App Shell key has no build component, so without it a new deployment served the previous one's shell. Tag keys stay shared across deployments, `next:tag:{tag}` and `next:uc-tag:{tag}`, so a revalidation reaches every live deployment.
3. **TTL on every key:** every entry gets `EX` = its finite `expire`, capped at `CACHE_ENTRY_MAX_TTL_SECONDS` (21 600 s, 6 h); an entry without a finite `expire` gets the cap (upstream: no TTL). ISR tag index sets get `EXPIRE` of the cap on every write, and `'use cache'` tag timestamps are written with the cap (upstream: no TTL). At Launch the cache shares a `noeviction` Valkey with BullMQ (ADR 0013), so no key may live forever. The rest of ADR 0006 D4 (in-process LRU tier, gzip, the 512 KB limit, the writes-off flag) is deferred (plan deviation 9).
4. **Factories over a `CacheRedisClient` port** (`createIsrCacheHandler`, `createUseCacheHandler`), so the unit tests pass a fake client; the default exports wire the real client. The client is opened lazily on first use instead of at module load, and never during `next build`.
5. **Typed errors:** a revalidation that cannot reach Valkey throws `CacheUnavailableError` (upstream: an anonymous `Error`). `NEXT_DEPLOYMENT_ID` is read through `readCacheConfig`, which throws `CacheConfigError` when it is missing outside development (upstream spike: fell back to `nodpl`).
6. **Logging:** failures are always logged as one JSON warning line (upstream: only with `NEXT_PRIVATE_DEBUG_CACHE`); the client's repeated reconnect errors are logged once per distinct message.
7. **Defaults:** `REDIS_URL` falls back to the host-run development Valkey `redis://localhost:6380` (upstream: port 6379).
