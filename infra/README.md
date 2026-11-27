# infra: OpenTofu edge (Cloudflare, DNS, R2)

OpenTofu manages only what has an API: Cloudflare DNS, edge rules, Turnstile, the Origin CA certificate and the
public-assets R2 bucket (ADR 0011, ADR 0012). The Algerian VPS is set up by Ansible (`infra/ansible/`) and the apps
are deployed by Kamal (`config/deploy*.yml`). Every tool runs from its pinned image through `scripts/ops/tool.sh`
(D3503); nothing is installed on the host.

| Path | What |
|---|---|
| `modules/cloudflare` | DNS (`*.`, `app.`, `api.`, `challenge.` under `base_domain`, all proxied), Full (strict) TLS, HTTPS only, TLS ≥ 1.2, URL normalisation, Bot Fight Mode off, WAF block of internal paths, the one Free-plan rate-limit rule, HTML cache rules, default `Referrer-Policy`, Turnstile widget, Origin CA certificate |
| `modules/r2` | Public-assets bucket and its `cdn.` custom domain. Refuses any name but `assets-*`: backups and private objects never go to R2 |
| `envs/staging` | The staging root: providers, R2 state backend with client-side encryption, both modules |

## What the edge rules guarantee (Review Focus 3)

- **Internal paths are blocked on every host** (store subdomains, custom hostnames, `app.`, `api.`): `/store`, `/shop-api*`,
  `/_internal`, `/_t`, `/api/internal` after recursive percent-decoding and lower-casing, plus any raw `/%5f…`. The app
  still guards them itself (InternalOnlyGuard + HMAC, ADR 0008); this keeps junk away from the origin.
- **Rate limit** (Free plan: one rule, path field, 10 s): `/search`, `/api/store/*`, `/product/*`, `/category/*`, per
  IP and Cloudflare data centre, 300 requests per 10 s by default. The floor of 100 is enforced because Algerian
  mobile carriers put many buyers behind one CGNAT address (D3226 f, #296).
- **Cache rules** apply to storefront hosts only (every host but `app.`, `api.`, `challenge.`, `cdn.`):
  - Edge and browser TTL "Respect origin": the storefront's `Cloudflare-CDN-Cache-Control` decides (ADR 0006).
  - 5xx and 429 are never stored (`-1` = no-store), because the proxy sets the cache header before it knows the
    status (D3226 f); a 404 is kept 30 s so one junk slug costs one origin call (#296).
  - Home and product pages drop only ad tracking params from the cache key (`fbclid`, `gclid`, `gbraid`, `wbraid`,
    `msclkid`, `ttclid`, `utm_*`). Listing and search keep `page`, `sort` and `q`. Add the landing-page prefix to
    `tracking_param_paths` when that route exists.
  - `/api/*`, `/__preview*`, `/search`, `/cart`, `/checkout`, `/success` and requests with Next preview cookies are
    never cached.
- **Referrer-Policy** `strict-origin-when-cross-origin` is added only when the origin sent none, so the invitation
  pages keep their `no-referrer` (#137 item 6).

## Checks (no credentials)

```sh
scripts/ops/tool.sh tofu fmt -check -recursive infra            # from the repo root
cd infra/envs/staging && ../../../scripts/ops/tool.sh tofu init -backend=false && ../../../scripts/ops/tool.sh tofu validate
cd infra/modules/cloudflare && ../../../scripts/ops/tool.sh tofu init && ../../../scripts/ops/tool.sh tofu test
cd infra/modules/r2 && ../../../scripts/ops/tool.sh tofu init && ../../../scripts/ops/tool.sh tofu test
```

The module tests plan against mocked providers and assert the guarantees above. They cannot prove that Cloudflare
accepts each expression on the Free plan; the first real `plan`/`apply` in P3.S5b does (see below).

## First apply (P3.S5b, needs the user's accounts)

1. **Zone.** Free Universal SSL covers the apex and `*.<root>` only, not `*.staging.<root>`. Pick one (D3513):
   a separate staging zone with `base_domain` = that zone's apex, or Advanced Certificate Manager on the main zone.
   The module owns the zone's rule-phase entry points, so one environment per zone either way.
2. **State bucket.** Create a private R2 bucket `cod-tofu-state` by hand (never public, never a custom domain) and an
   R2 API token limited to it. Copy `envs/staging/backend.hcl.example` to `backend.hcl` and fill in the account id.
3. **API token** for the provider, scoped to the zone and account: Zone DNS, Zone Settings, SSL and Certificates,
   Zone WAF, Cache Rules, Transform Rules, Bot Management (edit); Account Turnstile and Workers R2 Storage (edit).
4. **Passphrase** for state encryption: at least 32 characters, created and kept in the operator's password manager.
5. Copy `terraform.tfvars.example` to `terraform.tfvars` (git-ignored) and fill in ids, `base_domain`, origin IP.
6. Run, passing secrets by name only (`tool.sh` never puts a value on a command line):
   ```sh
   cd infra/envs/staging
   export TOOL_ENV="CLOUDFLARE_API_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY TF_VAR_state_encryption_passphrase"
   ../../../scripts/ops/tool.sh tofu init -backend-config=backend.hcl
   ../../../scripts/ops/tool.sh tofu plan -out=staging.tfplan
   ../../../scripts/ops/tool.sh tofu apply staging.tfplan
   ```
7. Check on the first plan/apply that the Free plan accepts: `url_decode(…, "r")` in the WAF rule, `status_code_ttl`
   in the cache rules, `starts_with` in the rate-limit rule. If one is refused, keep the guarantee another way and
   record it in `docs/roadmap/P3-decisions.md`.
8. Move the two secrets the state holds straight into the Kamal secret store, never onto the terminal or into a file
   in the repo: the Turnstile secret (`module.edge.cloudflare_turnstile_widget.challenge`, attribute `secret`) and the
   origin private key (`module.edge.tls_private_key.origin`, attribute `private_key_pem`), e.g. by piping
   `tofu show -json` through a JSON filter into the secret manager. The certificate itself is the sensitive output
   `origin_certificate_pem` of the module.
9. Only after the Ansible firewall lets 80/443 in from Cloudflare ranges only, set `STOREFRONT_TRUST_EDGE_IP=true`
   (D3226 d).

## Rules for changes

- No secret in a variable default, a tfvars file in git, an output or a log. Outputs that could leak stay
  `sensitive`; the Turnstile secret and the origin key are never outputs.
- Providers are pinned exactly; `envs/staging/.terraform.lock.hcl` is committed. Bump both together.
- R2 holds public assets only (ADR 0012). Production uses `assets-prod`; staging `assets-staging`.
