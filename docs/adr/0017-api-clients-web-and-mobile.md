# ADR-0017: API clients (web and mobile)

**Date**: 2026-11-08
**Status**: Proposed
**Deciders**: architect (draft), user

Citation keys: [BK, verify] = background knowledge about a platform or third party, verify before relying on it. Numbers marked "default" are starting values, tuned by the session that builds the feature.

## Context

- The user has decided that a future mobile app serves **both merchants and shoppers**. Feature inventory §15 lists orders, push notifications and scan-to-validate parcels and returns. **This ADR is design only: no mobile feature and no public buyer API is built now.** It fixes the rules so that today's API work does not close the door.
- Today the Admin API accepts `tokenMethod: ['cookie', 'bearer']` (`auth.config.ts`) and CORS is `env.CORS_ORIGINS` (`vendure-config.ts`). A bearer-only Admin API login is being proven in this PR (Evidence).
- Buyers have no public API. ADR 0008 keeps `/shop-api` internal, the storefront is the only buyer path, the store comes from the host, and Turnstile runs on COD submit (ADR 0012). A native app has no host and no Turnstile.
- Installed apps cannot be force-updated, so a server release can break a client we can no longer change. Vendure bumps (M.S1) can change its stock schema without regard to our clients.
- **Vendure 3.8.1 session facts, read from `@vendure/core` source**:
  - The stock `logout` calls `AuthService.destroyAuthenticatedSession`, which calls `deleteSessionsByUser`: **it deletes every session of that user**, not just the caller's.
  - `extractSessionToken` tries the **cookie before the `Authorization` header** when both methods are enabled.
  - `sessionDuration` is one global value. The default is `'1y'`, and `auth.config.ts` does not set it, so **ADR 0008's 30 d is not in force yet**.
  - The expiry is extended only once less than half of `sessionDuration` remains. `sessionCacheTTL` defaults to 300 s.
  - `SessionService` has no delete for a single session. Removing a row without also calling `sessionCacheStrategy.delete(token)` leaves the session usable until the cache entry goes stale.
- CORS is a browser control. A native HTTP client sends no `Origin`, so `CORS_ORIGINS` neither protects nor blocks it.

## Options

**Client contract**
1. **Native apps call the stock Admin API and Shop API.** Least work, but it couples installed apps to Vendure's schema and exposes `/shop-api`, against ADR 0006 and 0008. Rejected.
2. **Our own contract, owned by plugins, checked in CI against every supported client (recommended).**
3. **A separate backend-for-frontend service per client.** Extra deploy unit and a place for rules to leak into. Rejected (one image with roles, ADR 0013).

**Native session**
1. **Custom JWT access token + rotating refresh token.** Duplicates Vendure auth, needs a deny-list for revocation (the ADR 0008 Option 1 rejection applies), and refresh-reuse detection revokes healthy devices on poor mobile networks. Rejected.
2. **Vendure session as the bearer, one per device, wrapped by our device-session row and rotated on a schedule (recommended).** Revocation stays a session delete.

## Decision

Option 2 for both. Every rule below applies when the matching feature is built, except §1, which applies from now on.

### 1. Business logic stays in plugins, behind APIs
- Pricing, offers, eligibility, delivery fees, totals, stock and sold-out policy, spam, plan gates, permissions, order and parcel transitions, wallets and ledgers live in `plugins/<name>/domain` and `application`. The dashboard, the storefront and any mobile app are clients of them.
- **A client may**: format values with the shared formatter (ADR 0005, whole DZD); validate input for fast feedback using schemas from `packages/shared`, which the server re-runs; sort or filter a list it already holds; show an optimistic state marked pending; hide controls using the server's `effectivePermissions`, `capabilities` and per-object `allowedActions`; queue a scan offline with an idempotency key.
- **A client may not**: compute or adjust a price, discount, fee, subtotal or total, including quantity × unit price (it shows the quote's fields, ADR 0004); parse the quote token; decide whether an offer applies; decide the next status or whether a scan is valid (the server answers, also for replayed offline scans); evaluate a permission or plan gate as enforcement; hold a tenant id it chose as authority.
- `packages/shared` holds types, schemas, constants and formatters only. Boundary rules (CLAUDE.md §3a.11) stop `apps/storefront`, `plugins/*/dashboard` and native code from importing any plugin's `domain` or `application`. Recorded as CLAUDE.md §3a.16.

### 2. Versioning and backward compatibility
- **Merchant contract**: a plugin `client-api` adds `client*` operations and `Client*` types to the Admin API through `adminApiExtensions`. **Those types never expose or embed a Vendure type.** Native apps use only them, including for login and logout (§3). The facade is a stability boundary, not an authorization boundary: the bearer is still an Admin API session under the member's roles.
- **Buyer contract**: REST at `/buyer/v1` (§7), matching the storefront's REST protocol.
- **GraphQL is additive only.** Allowed: new types, new fields, new optional arguments. Forbidden without the window below: removing or renaming, changing a type, nullable to non-null on an input, non-null to nullable on an output, a new required argument.
- **New enum values and union members count as additive only because clients must tolerate them**: generated clients map unknown values to `UNKNOWN`, and order statuses carry a server-sent localized label.
- **Deprecation window**: `@deprecated` with a replacement and date. Removal needs all of: at least 12 months since the deprecation shipped (default), no supported build's manifest uses it, under 1 % of 30-day active clients still call it. Buyer REST: a breaking change means `/buyer/v2`, with `v1` kept for the same window.
- **Operation manifests**: each native release commits its GraphQL documents to `packages/client-contracts/<app>/<build>.graphql`. CI validates every manifest of every supported build against the current schema. **M.S1 fails if a Vendure bump breaks any manifest**, which also catches the transport pieces we cannot wrap (`Authorization`, `vendure-token`, the auth token header), pinned by the bearer test.
- **Client signal**: every native request sends `X-Client: <appId>/<platform>/<semver>/<build>`; metrics count by build (ADR 0015). The header is a compatibility signal, not a credential.
- **Supported versions**: a platform table holds, per (app, platform), `recommended_build`, `min_supported_build` and a message. Default: soft upgrade at 6 months old, hard at 18. A security fix may raise the hard floor at once, with a recorded reason.
- **Upgrade signal**: `X-Client-Upgrade: soft` on responses (dismissable prompt). Hard: GraphQL error code `CLIENT_UPGRADE_REQUIRED`, REST `426`, full-screen store link. `clientStatus`, logout and push unregistration always work, so a blocked app can still clean up.

### 3. Native sessions (merchants)
- **One Vendure session per (installation, user)**. `clientDeviceLogin` authenticates through the existing strategies and `SessionService.createNewAuthenticatedSession` with `apiType: 'admin'`, then writes `client_device_session` (`id`, `business_id`, `user_id`, `installation_id`, `session_id`, `app_id`, `platform`, `app_version`, `created_at`, `last_seen_at`, `rotated_at`, `absolute_expires_at`, `revoked_at`, `revoke_reason`). Tenant table, `TenantRepository`.
- **Lifetime**: ADR 0008's 30 d sliding applies (`sessionDuration` is global), and P1.S2 must set it to `'30d'` in `auth.config.ts`. Absolute cap 180 d (default), enforced by a scheduled task that deletes the session, so stock operations are covered too; then full login again. Device biometrics only unlock the app and never extend a session.
- **Rotation**: `clientRotateSession` when the token is over 7 days old (default) creates a new session and returns it. The old one stays valid for 5 min, so a lost response does not log the device out, then is deleted. No reuse detection: a retired token simply fails.
- **Device storage**: iOS Keychain, `AfterFirstUnlockThisDeviceOnly`; Android Keystore-backed encryption, excluded from backup [BK, verify current Android API]. Never plain preferences, logs or crash reports.
- **No cookie jar on native HTTP clients.** Vendure reads the cookie first, so a stale cookie would silently override the bearer and mix up accounts on a multi-account device.
- **No certificate pinning**: Cloudflare manages the edge certificates, and a rotated certificate would brick installed apps.
- **Revocation and logout**: `clientDeviceLogout` deletes that session and its push registrations and calls `sessionCacheStrategy.delete`. `clientLogoutAllDevices` uses `deleteSessionsByUser`. Password change and member removal revoke all sessions (ADR 0008) and go through the same cleanup. The dashboard Security page lists devices and revokes one. **Native never calls stock `logout`, and before the app ships the dashboard's logout must stop deleting mobile sessions** (it wipes them all today; shadow the resolver in a plugin or route the dashboard through ours [BK, verify the override]).
- Maximum 10 active device sessions per user (default); login evicts the least recently seen. Platform staff (mandatory TOTP, ADR 0008) have no native sessions. Merchant sign-up stays on the web, in the system browser, so Turnstile on sign-up still guards free credits.
- **CORS**: native origins are never added to `CORS_ORIGINS`. If a webview shell is ever chosen, its exact origin is added, never a wildcard.

### 4. Push device registration
- **Entity `push_registration`**: `id` snowflake, `business_id` (always set), `audience` (`merchant` | `buyer`), `user_id` (merchant), `session_id` (merchant), `store_id` and `order_id` (buyer), `installation_id`, `app_id`, `provider` (`fcm` | `apns` | `hms`), `token_enc`, `token_hash`, `locale`, `app_version`, `created_at`, `last_seen_at`, `expires_at` (buyer), `invalidated_at`, `invalid_reason`. Unique (`business_id`, `audience`, `user_id` or `order_id`, `app_id`, `token_hash`). `TenantRepository` and the two-business isolation test apply.
- **Tenant binding comes from the credential**, never from input: merchants from the session's business, buyers from a receipt token. Intake returns `rc1.<{o, b, s, exp}>.<HMAC>`, which grants only that order's tracking and push registration. Buyer rows expire 30 days after the order is terminal (default).
- **Multi-account devices**: one provider token may have one row per account or order, each tied to its own session. The push payload carries an opaque `accountRef`; the app drops the alert if that account is no longer signed in locally. Maximum 5 merchant accounts per installation (default).
- **Unregistering**: logout, session revocation and member removal delete the session's rows in the same transaction. A provider "unregistered" answer (FCM `UNREGISTERED`, APNs 410 [BK, verify]) sets `invalidated_at` on that row. Token refresh is re-sent by the app per signed-in account, so no query crosses tenants. Rows not seen for 90 days (default) are purged by `retention-purge`.
- **Delivery**: domain event → `OutboxService.add` in the same transaction → relay → `order-effects` fan-out (at most 100 per job, ADR 0013) → `notifications`, whose `outbox_delivery` row is the durable record (ADR 0016). The idempotency key extends ADR 0016's event + user + channel with the registration id, so a retry after a partial send does not repeat delivered devices, and the same key is the provider collapse id.
- **Adapters**: `FcmPushChannel`, `ApnsPushChannel` and later `HmsPushChannel` are new adapters behind the notification-channel port (CLAUDE.md §3a.7), beside web push, with no `switch` on provider. The P7.S3 per-event Push preferences apply.
- **Payloads carry no personal data**: event type, opaque ids, generic text. The app fetches details over the API. Push providers are outside Algeria, so buyer names, phones and addresses must not transit them (ADR 0011, Law 18-07 Art. 44). Installation and push tokens are personal data and are covered by erasure.

### 5. Rate limits for merchant clients (no Turnstile)
Redis token buckets, as ADR 0008. Cloudflare Free has one rule, already used for intake and path-only (ADR 0012), so merchant limits are application-level until Pro. Over the limit: `429` with `Retry-After`.
- `clientDeviceLogin`: per account 10/min with lockout and backoff (ADR 0008); per IP 60/min (default), because a 10/min IP limit would lock out everyone behind one CGNAT address.
- Admin API: per business 20 rps, burst 100 (ADR 0008); **plus per device session 5 rps, burst 30** (default), so one device cannot spend the whole business budget. Offline scan replays are batched and idempotent.
- `clientRotateSession` 6/h per device session; push registration 10/h per device session (defaults). `HardenPlugin` query complexity applies unchanged.

### 6. Rate limits for buyer clients (no Turnstile)
Client IP comes from `CF-Connecting-IP` as on the storefront proxy (`trustProxy: 1` does not describe the full chain [BK, verify in P3.S5]). IP is never the only key, because Algerian mobile CGNAT is assumed (ADR 0012, unverified).
| Bucket | Quotes | Intake | Over the limit |
|---|---|---|---|
| (store, install token) attested | 60/min | 5 per 10 min | quotes `429`; intake **held for review** |
| (store, install token) not attested | 30/min | 2 per 10 min | same |
| (store, IP), high | 600/min | 60 per 10 min | same |
| (store, phone) | n/a | spam-engine velocity rule | held |
| per-store global cap | ADR 0008 | ADR 0008 | held |

All values are defaults, validated by the P3.S5 k6 profile and about 10 quotes per order (ADR 0004). `/buyer/v1/orders*` joins Cloudflare rule #1 (abuse level only).

### 7. Future public buyer API: ADR 0008's protections without Turnstile
- **Surface**: a plugin `buyer-api` serves `api.ourdomain/buyer/v1/*`. It calls the same `PricingService` and intake application services in-process. **`/shop-api` and `/store/*` stay internal and blocked at the edge, and no path bypasses intake**: the COD eligibility checker still accepts only intake-created orders. No login (ADR 0008). No CORS.
- **Store resolution**: `POST /buyer/v1/store-context {host}` resolves the host through the same normalisation and host map as `proxy.ts`. Unknown or disabled host: 404. It returns a signed context `sc1.<{kid, s, b, host, app, exp}>.<HMAC>` (24 h, own key set), sent on every call. **A client-supplied store or business id never selects the tenant**; if present and different, 400 and a spoofing signal, as ADR 0008. A per-store app has a server-side `client_app → store` row, and attestation (when present) confirms the app id; without attestation the app id is only a claim.
- **Quote token**: unchanged as the price commitment (ADR 0004). Intake checks signature, `kid`, `exp`, cart hash and one-order-per-token, and checks `b`/`s` against the store context instead of the host. Prices come only from the token.
- **Device identity**: a server-issued install token (signed, rate limited per IP at a high limit), not a client-chosen id. Unknown ids share the (store, IP) bucket, so rotating ids buys nothing. It remains an abuse signal, not identity (ADR 0008).
- **Spam and hold**: the same spam engine runs with `source = native`. Over any limit, or held by a rule, the order is **held for review, never rejected**, and the response has the same shape as an accepted order; reason codes never reach the client.
- **Attestation is a signal, never a gate.** Play Integrity (Android) and App Attest (iOS) are requested at submit, bound to the order by using SHA-256 of the quote token hash as the request hash or client data hash, to stop replay. Results go to the spam engine: `ATTESTATION_PASS` (the higher bucket), `ATTESTATION_FAILED` (hold), `ATTESTATION_UNAVAILABLE` (lower bucket, no hold on its own). Native must not report `TURNSTILE_UNAVAILABLE`, or ADR 0012's hold would catch every native order.
- **Attestation limits** [BK, verify all before building]: Play Integrity needs Google Play services, so Huawei and sideloaded devices return nothing (their Algerian share is unknown); daily quotas apply by default; App Attest needs a recent iOS and can be unavailable; hooked or rooted devices can defeat verdicts; a pass proves a genuine app on a device, not a genuine buyer. Verification may call providers outside Algeria, so only hashes are sent.
- **CGNAT**: the rules above; a blocked IP is never the outcome of buyer limits.
- **ADR clauses to amend when built** (no change now):
  - 0008 surfaces table: add a "Buyer on native app" row; the merchant row gains native clients and drops "same-origin" for them. The "Vendure Shop API" row stays as is.
  - 0008 "Public storefront endpoints": store resolution gains the signed store context beside the host; the quote-token bullet says "host or store context"; rate limits gain §6.
  - 0008 "Rate limits": login IP limit per §5; Admin API per-device bucket.
  - 0004 Intake verification step 1: same "host or store context" wording.
  - 0006 §7 and 0012: `/buyer/v1` in the `api.ourdomain` route list, Bot Fight skip rules, and Turnstile "COD submit" scoped to web.
  - 0016: notification idempotency key (§4 above); retention row for `push_registration`.

## Consequences

### Positive
- Rules stay in one place, so a mobile client adds screens, not logic.
- A Vendure bump cannot silently break an installed app: the manifest check fails first.
- Sessions, roles and revocation remain Vendure's. Native adds one wrapper table.
- The buyer API reuses quote, intake and spam, and needs no new money path.

### Negative
- A facade to maintain beside the Admin API, partly duplicating stock reads.
- Manifests and old builds must be kept and validated for up to 18 months.
- Buyers without attestation get lower limits, and more of their orders may be held.

### Risks
- **The dashboard's stock logout wipes every device of that user** until §3 is done. Harmless today, a release blocker for the app.
- **A bearer stolen from a device is a full Admin API session for up to 30 d.** Mitigation: secure storage, rotation, device list, revocation. It carries the member's roles, so high-risk actions keep their own server-side checks.
- **Without Turnstile a scripted client can create real-looking orders.** Mitigation: signed install tokens, phone velocity, holds, attestation. Merchant-visible hold volume is the metric that decides whether limits tighten.
- **Vendure changes** to `createNewAuthenticatedSession`, `sessionCacheStrategy` or token extraction order: pinned by the bearer test and re-run in M.S1.
- **Legal**: push and attestation providers sit outside Algeria; whether token metadata counts as a transfer joins ADR 0011's open question.

## Evidence

No spike. Design only.
- [x] Vendure 3.8.1 session behaviour in Context, read from `@vendure/core/dist` (`service/services/auth.service.js`, `service/services/session.service.js`, `api/common/extract-session-token.js`, `api/common/set-session-token.js`, `config/default-config.js`), 2026-11-08.
- [x] Bearer-only Admin API login with no cookie: `apps/server/tests/e2e/bearer-client.e2e.test.ts` and the live transcript `docs/evidence/P0.S2c-polish/api/bearer-client.md`, 2026-11-08.
- Not tested: every item marked [BK, verify]; native client libraries; provider quotas; Algerian device mix.

## Open questions for the user

1. **Shopper app shape**: one shared app across all stores, one white-label app per store, or both? §7 supports both; it changes app-store cost, attestation app ids and the store-picking UX. Decide before the buyer API is scheduled.
2. **Shopper accounts**: ADR 0008 has no buyer login, and this ADR keeps that (install and receipt tokens only). Cross-device order history would need phone-OTP login and its own ADR. Wanted?
