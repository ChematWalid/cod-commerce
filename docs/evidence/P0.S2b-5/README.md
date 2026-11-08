# Evidence for P0.S2b-5 (storefront)

Screenshots and request/response transcripts of the real storefront (Next.js 16, `apps/storefront`) running as the
`storefront` role of the compose stack (CLAUDE.md §3a.14). Produced by `scripts/evidence/P0.S2b-5.sh`; nothing here is
hand-written. Data is synthetic: the storefront's two stub stores (placeholders from `.env.example` for the rest).

- Image: `cod-platform:local`, built by that run (`docker compose build migrate`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is `3f1cfac6cc8d32b4f95f2cc3c32fc61cddb129ff`.
- `NEXT_DEPLOYMENT_ID` of the running container: `dev` (it namespaces the shared cache keys and the assets).
- Stack: compose project `cod-evidence`; only `storefront` and the `valkey` it depends on are started. Host port
  `23001` (container port 3001).

## Screenshots

Viewport screenshots (not full page), `reducedMotion: reduce`, taken after the page loaded and two animation frames. Chromium
resolves `*.localhost` to the loopback address, so the store is chosen by the `Host` header the browser sends. Before each
shot the script asserts the status of the main document, that the marker element is visible with the expected text and that
the other stores' names are absent from the page.

| File | URL | Viewport | Status | Asserted |
| --- | --- | --- | --- | --- |
| [`demo-desktop.png`](screens/demo-desktop.png) | `http://demo.localhost:23001/` | desktop 1280x800, scale 1 | 200 | Demo Store (store locale `ar`): `store-name` visible with `Demo Store`; `Second Store` absent |
| [`demo-mobile.png`](screens/demo-mobile.png) | `http://demo.localhost:23001/` | mobile 390x844, touch, scale 2 | 200 | Demo Store (store locale `ar`): `store-name` visible with `Demo Store`; `Second Store` absent |
| [`second-desktop.png`](screens/second-desktop.png) | `http://second.localhost:23001/` | desktop 1280x800, scale 1 | 200 | Second Store (store locale `fr`): `store-name` visible with `Second Store`; `Demo Store` absent |
| [`second-mobile.png`](screens/second-mobile.png) | `http://second.localhost:23001/` | mobile 390x844, touch, scale 2 | 200 | Second Store (store locale `fr`): `store-name` visible with `Second Store`; `Demo Store` absent |
| [`not-found-desktop.png`](screens/not-found-desktop.png) | `http://nope.localhost:23001/` | desktop 1280x800, scale 1 | 404 | the not-found page (unknown host): `not-found` visible with `Page not found`; `Demo Store`, `Second Store` absent |
| [`not-found-mobile.png`](screens/not-found-mobile.png) | `http://nope.localhost:23001/` | mobile 390x844, touch, scale 2 | 404 | the not-found page (unknown host): `not-found` visible with `Page not found`; `Demo Store`, `Second Store` absent |

The pages are intentionally bare: P0 only proves that the store is resolved from the host. The store locale (`ar` for the
demo store, `fr` for the second) is data of the store; the P0 page does not translate or mirror yet (the document is
`lang="en"`).

## API transcripts

| File | Shows |
| --- | --- |
| [`api/livez.md`](api/livez.md) | `GET /livez` with an arbitrary Host: 200 |
| [`api/readyz.md`](api/readyz.md) | `GET /readyz`: Valkey running (200, `checks.redis.ok: true`), Valkey stopped (still 200, `ok: false`), Valkey started again (200, `ok: true`); `cache-control: no-store` each time |
| [`api/host-routing.md`](api/host-routing.md) | `GET /` by Host: demo.localhost, second.localhost (200, own heading), nope.localhost (404), the internal `/_t/second/fr` path on demo.localhost (404), and `X-Forwarded-Host` ignored (404) |

Only the headers `content-type`, `cache-control` and the ones the script shows are printed (so no `date` or request id), the
per-check `durationMs` is dropped, and HTML bodies are cut to the identifying element by the script; the checks run on the whole
body. The same input therefore regenerates the same files.

## Checks (the script fails otherwise)

- Every transcript's status and body text as listed above; `/readyz` carries `cache-control: no-store` in all three states.
- Exactly 6 PNGs, each at most 300 KB.
- No value of a password, secret, token or key from `.env` appears anywhere in this folder.

## Re-run

```bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-5.sh
```

It uses its own compose project (`cod-evidence`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
