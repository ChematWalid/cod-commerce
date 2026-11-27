# Staging deploy with Kamal 2

The app roles (api, worker, storefront) of the one platform image run under Kamal 2. Migrations run in the
pre-deploy hook. The data tier runs from `docker-compose.yml` on the same host. OpenTofu manages the edge
(`infra/tofu`). Ansible prepares the server (`infra/ansible`). Decisions: D3503, D3504, D3516, D3517 in
`docs/roadmap/P3-decisions.md`.

| File | What it holds |
|---|---|
| `config/deploy.yml` | Roles, limits, proxy rules, secret **names** (Kamal's fixed path at the repo root). |
| `config/deploy.staging.yml` | The staging host, domains and `APP_ENV`, read from the environment at render time. |
| `.kamal/hooks/pre-deploy` | Runs the new version's `migrate` once before any container of that version starts. |
| `.kamal/secrets.example` | `NAME=$NAME` lines only. Copy it to `.kamal/secrets.staging` (git-ignored). |

Kamal runs only through `scripts/ops/tool.sh kamal …`, the pinned image (D3503). Nothing is installed on the host.

## How a deploy runs

`kamal deploy -d staging --skip-push --version=<sha>` runs in the `deploy-staging` workflow, with an image that
CI has already pushed. The steps:

1. Kamal pulls `ghcr.io/<owner>/platform:<sha>` on the host.
2. The **pre-deploy** hook runs this, as one container on the primary host:

   ```sh
   kamal app exec --primary --roles=api --version=<sha> 'env ROLE=migrate sh /app/scripts/docker-entrypoint.sh'
   ```

   The container uses the api's env file, networks and limits. A failed migration fails the hook, and Kamal
   stops before any new container starts (ADR 0013).
   - `--roles=api` is required. Without it, `app exec` starts one container per role on the host, so migrations
     would run three times, once with the storefront's environment.
3. Kamal starts each role's new container:
   - **api and storefront:** kamal-proxy calls `/readyz` every 2 s. It moves traffic once the check passes, and
     gives up after `deploy_timeout`, 120 s. It then drains the old container for up to `drain_timeout`, 75 s.
     Kamal stops that container with `docker stop` and no `-t`, so the container's `--stop-timeout 35` applies.
     That is above the api's 25 s request drain plus close.
   - **worker:** not proxied. Kamal waits for the image `HEALTHCHECK` (`healthcheck.js` on port 3020) to report
     healthy. It then stops the old worker with `docker stop -t 75`, above the worker's 65 s watchdog (D3508).
4. Rollback: `kamal rollback -d staging <previous-sha>`. Expand/contract migrations make that safe. The hook
   runs again for the old version and finds nothing to migrate.

## Two orchestrators on one host: the network join

Kamal puts app containers on its own `kamal` network. The data tier is the compose project `cod`, whose network is
`cod_default` (Ansible `data_tier`). Every role passes `--network cod_default` through `options.network`, so its
containers sit on **both** networks (Docker ≥ 25 accepts repeated `--network`; the baseline pins Docker 29):

- On `cod_default`, the compose service names `pgbouncer`, `postgres`, `valkey`, `garage` and (with the ops
  profile) `otel-collector` resolve. `DATABASE_URL` points at `pgbouncer:5432`, `DATABASE_URL_DIRECT` at
  `postgres:5432`.
- On `kamal`, kamal-proxy carries node-internal traffic under two network aliases:
  - `api.internal` → api: the storefront's `INTERNAL_API_URL`.
  - `storefront.internal` → storefront: the worker's `STOREFRONT_INTERNAL_URL` (revalidation).

  Both go through the proxy, not to a container name. That way a rolling swap never sends a request to a draining
  container (D3511).

The aliases are a one-time setting on the proxy container. Set it before the first `kamal setup`, or apply it later
with `kamal proxy reboot`:

```sh
scripts/ops/tool.sh kamal proxy boot_config set -d staging \
  --docker-options network-alias=api.internal network-alias=storefront.internal
```

Data ports stay on the host's loopback. The app reaches them over `cod_default`; the operator reaches them over an
SSH tunnel. Kamal never starts, stops or upgrades the data tier, and compose never touches the app containers.

## Edge, TLS and client IP

- kamal-proxy terminates TLS with the **Cloudflare Origin CA** certificate. OpenTofu creates it, with its private
  key in encrypted state, and the two `ORIGIN_CA_*_PEM` secrets carry it. Cloudflare runs Full (strict).
- `ssl_redirect` is off. Cloudflare connects only over 443, and the `.internal` hosts are plain HTTP inside the node.
- Host rules:
  - `app.<base>`, `api.<base>` and `api.internal` go to the api.
  - `*.<base>`, `<base>` and `storefront.internal` go to the storefront.
  - kamal-proxy is expected to prefer an exact host over the wildcard. Verify that on the P3.S5b server
    (infrastructure.md §2 [BK]).
  - A host-less default route is not possible: Kamal refuses TLS on a proxy role without hosts. Custom domains
    (Cloudflare for SaaS) therefore need their own rule. That is a P3.S5b decision (D3517).
- Node-level probe: `GET https://<any-store-host>/api/readyz`. The storefront answers 200 only while it is up
  **and** the node-local api's `/readyz` answers. A single-node staging setup has no separate load balancer.
- `TRUSTED_PROXY_HOPS=1` (kamal-proxy, with `forward_headers: false`, sets `X-Forwarded-For` and `-Proto` itself)
  and `CLIENT_IP_HEADER=CF-Connecting-IP`.
- `STOREFRONT_TRUST_EDGE_IP=true` is set for staging. Deploy only **after** the Ansible baseline has locked
  80/443 to Cloudflare's ranges (`COD-EDGE` chain, D3514). A direct hit could otherwise forge
  `CF-Connecting-IP` (D3213, D3226 d).

## Variables and secrets

`config/deploy.staging.yml` fails at render time when a required variable is missing. The deploy job sets them
from the `staging` environment's **variables**:

- `GITHUB_REPOSITORY_OWNER` (set by Actions);
- `KAMAL_REGISTRY_USERNAME`;
- `STAGING_HOST`;
- `STAGING_BASE_DOMAIN`;
- `STAGING_S3_PUBLIC_ENDPOINT`;
- `STAGING_SMTP_HOST`, `STAGING_SMTP_PORT` and `STAGING_SMTP_FROM`.

These are optional and blank means off:

- `STAGING_OTEL_EXPORTER_OTLP_ENDPOINT`;
- `STAGING_SENTRY_DSN` and `STAGING_STOREFRONT_SENTRY_DSN`;
- `STAGING_CLOUDFLARE_ZONE_ID`;
- `STOREFRONT_ASSET_PREFIX`, which must equal the image's build argument.

A blank optional value renders as a bare `--env NAME`. Docker leaves the variable unset in the container, which
the app treats the same as blank.

Every name in `.kamal/secrets.example` is a `staging` environment **secret**, exported to the job's
environment. Generate the values on the operator's machine, using the formats in the root `.env.example`. Never
mint them in CI, paste them into chat or echo them in a step.
- The storefront gets only `INTERNAL_HMAC_*` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, none of the server's
  secrets.
- The pre-deploy hook sees every secret in its environment, so it never traces (`set -x`) or prints its
  environment.

## Checking the config locally

From a git worktree, Kamal cannot read the commit, so pass `--version`. The values are placeholders:

```sh
GITHUB_REPOSITORY_OWNER=example KAMAL_REGISTRY_USERNAME=example STAGING_HOST=203.0.113.10 \
STAGING_BASE_DOMAIN=staging.example.dz STAGING_S3_PUBLIC_ENDPOINT=https://files.staging.example.dz \
STAGING_SMTP_HOST=smtp.example.dz STAGING_SMTP_PORT=587 STAGING_SMTP_FROM=noreply@staging.example.dz \
TOOL_ENV="GITHUB_REPOSITORY_OWNER KAMAL_REGISTRY_USERNAME STAGING_HOST STAGING_BASE_DOMAIN STAGING_S3_PUBLIC_ENDPOINT STAGING_SMTP_HOST STAGING_SMTP_PORT STAGING_SMTP_FROM" \
  scripts/ops/tool.sh kamal config -d staging --version=0123456789abcdef0123456789abcdef01234567
scripts/ops/tool.sh shellcheck .kamal/hooks/pre-deploy
```

`packages/config/tests/kamal-deploy.test.ts` pins the following:

- roles, limits and heap flags;
- host rules, health checks and the stop timeouts;
- that secrets are names only, and that real secrets files are git-ignored;
- the hook's migrate command.

## First deploy (P3.S5b, needs the server and accounts)

1. Run the Ansible baseline, which includes the firewall lockdown and the data tier (`infra/ansible/README.md`).
2. Set the proxy aliases (above).
3. Run `kamal setup -d staging --skip-push --version=<sha>` from the deploy workflow's manual dispatch.
4. Smoke and warm-up (`scripts/ops/warm-up.sh`).
