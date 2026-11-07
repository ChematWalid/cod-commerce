# ADR-0001: Repo layout and upstream (build from source vs published `@vendure/*` packages)

**Date**: 2026-11-07
**Status**: Proposed — the user confirms in the P0.S2a-1 PR review
**Deciders**: architect (draft), user (confirmation)

Citation keys: [VN §n] = `docs/architecture/research/vendure-v3.md` section n; [EH §n] = `docs/architecture/research/edge-hosting-costs.md` section n; [BK] = background knowledge, verify before relying on it.

## Context

- The roadmap originally seeded a private repository from `vendurehq/vendure` history with an `upstream` remote and left "build from source vs published packages" to this ADR. P0.S1 already created a clean repo (`ChematWalid/cod-commerce`) on the assumption that this ADR recommends published packages.
- Vendure's documented path is `npx @vendure/create` plus the published `@vendure/*` npm packages, all bumped to the same version on upgrade [VN §8, https://docs.vendure.io/current/core/developer-guide/updating].
- Our hard rule is "core is never modified": every feature is a plugin [repo-evaluation.md "Recommendation: Vendure"]. Building core from source gives us nothing we are allowed to use.
- Current version: **Vendure 3.8.1** (every `@vendure/*` package we need exists at 3.8.1; `npm view`). Vendure ships roughly quarterly minors that still contain breaking items (3.8.0: NestJS 12, Apollo Server 5, an order-line promotion data migration, a `ctx.session.token` type change) [VN §8, https://docs.vendure.io/changelog?focus=v3.8.0].
- Runtime: `@vendure/core@3.8.1` declares **no `engines` field**. The Vendure docs require Node.js ≥ 20.19 or ≥ 22.12. The project machine and CI run **Node 24.22.1**, which is inside the documented range but not explicitly listed; spike A (P0.S2a-1 Task 1) runs the scaffold on it.
- Licence: GPLv3 or commercial. Changes to the framework must be GPLv3. `plugin-exception.txt` lets plugins use another licence. Hosting a SaaS is not "distribution" under GPLv3 [VN §8, https://raw.githubusercontent.com/vendurehq/vendure/HEAD/license/license-faq.md].
- CI time matters: 62+ agent sessions each end in a PR and wait for `gh pr checks --watch`. The upstream monorepo builds dozens of packages and ships its own workflows, which would have to stay disabled.

## Options

### A. Build inside the upstream monorepo (core built from source)
- **Pros**: a core bug can be patched in place; upstream source sits next to our code.
- **Cons**: the root `package.json` and lockfile are shared with upstream, so every M.S1 sync is a merge with conflicts. CI must build core (est. 10–20 min more per PR [BK]). Upstream workflows must be re-disabled after every sync. Editing core is easy and forbidden, so any edit is a GPL-scope and upgrade hazard.
- **Why not**: it pays the full cost of a fork for a capability (core edits) we have banned.

### B. Same repo seeded from upstream history, but our workspace consumes the published packages
- **Pros**: upstream source stays one `git log` away; the published packages keep CI fast.
- **Cons**: two "truths" in one repo: upstream `packages/*` (which nobody builds) and the npm versions we actually run. They drift unless M.S1 does both a merge and a bump. Upstream files confuse search, lint and agents (wrong `packages/` hits), and upstream workflows still need disabling.
- **Why not**: we pay for the mirror and get only reading convenience. A pinned reference checkout outside the repo gives the same thing.

### C. Clean private app repo on the published `@vendure/*` packages, with patching as a controlled escape hatch
- **Pros**: this is the documented Vendure path. CI builds only our code. An upgrade is "bump every `@vendure/*` to X.Y.Z, regenerate migrations, fix types". No upstream workflows. Licence scope stays clean: core is untouched npm, our code is plugins.
- **Cons**: core cannot be patched by editing source (mitigation: `pnpm patch`, rules below). Upstream source is not in the repo (mitigation: a read-only reference clone at the pinned tag outside the repo, or GitHub links at the tag).

## Decision

We adopt **Option C**.

1. **Repository**: the private repo `ChematWalid/cod-commerce` (renamed once the product name is chosen, ADR 0007), with no upstream history and no `upstream` remote. Vendure source for reading is a shallow clone at the pinned tag outside the repo (`%USERPROFILE%/src/vendure@3.8.1`) or GitHub links at the tag.
2. **Dependencies**: every `@vendure/*` package is pinned to **one exact version, the same for all** (no `^`/`~`), currently **3.8.1**. A CI check fails if two `@vendure/*` entries differ. Renovate or Dependabot may propose versions, but only M.S1 merges a minor; a patch release may be taken by a normal PR under the "latest patch" policy (tech-stack.md).
3. **Package manager and runtime**: **pnpm** workspaces (pnpm 10, `packageManager` pinned in the root `package.json`) with Turborepo task caching. **Node 24** (`.nvmrc` / `engines.node` `>=24.22 <25`) as long as the pnpm smoke and spike A pass on it; otherwise Node 22 LTS with a planned bump before its end-of-life (2027-04-30) [BK].
4. **Layout**:
   ```
   apps/server        Vendure bootstrap: api, worker, migrate entry points (one image, ADR 0013)
   apps/storefront    Next.js 16 storefront, builder preview, marketing and sign-up pages (ADR 0006)
   plugins/<name>     one Vendure plugin per module; dashboard code in plugins/<name>/dashboard/ (ADR 0010)
   packages/shared    zod schemas, constants (wilayas, statuses, permissions), domain event names, queue names, i18n catalogues (ADR 0005)
   packages/config    eslint / tsconfig / vitest presets
   infra/             OpenTofu (ADR 0011)
   deploy/            Kamal config and hooks (ADR 0013)
   load/              k6 scripts
   patches/           pnpm patch files (escape hatch, below); empty by default
   docs/              research, roadmap, architecture, adr
   ```
5. **Escape hatch (patching core)**: allowed only through `pnpm patch @vendure/<pkg>@<exact>` → `pnpm patch-commit`, which writes `patches/@vendure__<pkg>@<exact>.patch` and a `pnpm.patchedDependencies` entry. Each patch needs (a) a PR labelled `vendure-patch` linking the upstream issue or PR, (b) a short ADR addendum, (c) a test that fails without the patch, (d) the smallest possible diff. A patch is tied to an exact version, so any bump forces a re-decision. Patches are GPLv3 modifications, so a patch file never contains our proprietary logic. Default stance: fix it in a plugin, strategy override or custom field first.
6. **CI time budget**: the **PR pipeline must finish in ≤ 10 min wall-clock** (lint + typecheck + unit + integration on a Postgres service + build, plus the attribution check). Why 10: with option C CI builds only our code; with Turborepo caching and lint/typecheck, unit, integration and build as parallel jobs, the longest job (integration with a Postgres service, est. 5–7 min once all plugins exist [BK]) fits with margin; agent sessions block on `gh pr checks --watch`, so every extra minute is paid 62+ times. If the p90 of the last 20 PR runs exceeds 10 min, the next session opens a CI-speed task (sharding, cache review) before adding features. E2E Playwright runs on merge to `main` and nightly, ≤ 20 min.
7. **M.S1 procedure (replaces "merge the upstream tag")**, one session per Vendure minor:
   1. Read the release notes, changelog and migration guide for every version between the current pin and the target; list breaking items in the session plan.
   2. Bump **all** `@vendure/*` pins to the same exact target version in one commit; `pnpm install`.
   3. Re-validate every file in `patches/`: drop it if upstream fixed the issue, otherwise regenerate it against the new version and re-run its test. No patch survives a bump unreviewed.
   4. Generate the core migration (`npx vendure migrate --generate vendure-<version>` against a DB at the previous schema), **review it line by line** (data migrations, locks on large tables, index changes), and test it on a copy of staging data.
   5. Adapt plugins and types; full suite + E2E; staging soak before production.
   6. Write an ADR addendum `docs/adr/NNNN-upstream-sync-<version>.md` (breaking items, patches dropped/kept, migration notes) [VN §8, §9].
8. **GPL note**: core stays unmodified npm code (patches excepted, GPLv3). Our plugins use the plugin exception. We do not distribute the server (SaaS), and any future self-hosted offering needs the commercial licence. Counsel confirms before launch [VN §8].
   **Open question for counsel (not legal advice)**: the merchant dashboard is one Vite bundle that compiles `@vendure/dashboard` (GPLv3) together with our dashboard extensions and is **sent to every merchant's browser**. Sending JavaScript to a browser may count as conveying object code, unlike running the server. Counsel should confirm whether the plugin exception covers the compiled dashboard extensions, or whether the dashboard bundle (and so our extension code) must be offered under GPLv3. If it must and that is unacceptable, ADR 0010 Option 2 (own admin app talking to the Admin API) avoids it. The Next.js storefront contains no Vendure code.

## Consequences

### Positive
- Fast CI that builds only our code. Upgrades are a version bump plus a migration review, as Vendure documents.
- Search, lint and agents never trip over upstream `packages/*`. There are no upstream workflows to police.
- The core-modification ban is enforced structurally (there is no core source to edit), and any exception is visible in `patches/`.

### Negative
- We cannot step-debug into core TypeScript sources without source maps or the reference clone.
- A critical core bug waits for upstream or goes through a reviewed patch.

### Risks
- **pnpm strictness vs NestJS/TypeORM peer deps, native builds (`onlyBuiltDependencies`) or the dashboard Vite plugin.** Mitigation: the pnpm smoke below. If resolution breaks, set `node-linker=hoisted`; if that still fails, fall back to npm workspaces + patch-package, and record which in the P0.S2b handoff.
- **Node 24 not explicitly supported.** Mitigation: spike A and the pnpm smoke boot the API and dashboard on Node 24.22.1; fallback Node 22 LTS (Decision 3).
- **Breaking minors.** Mitigation: exact pins, a dedicated M.S1 session per minor, staging soak before production.

## Evidence

pnpm smoke: see Evidence, added by the spike run.

- [ ] pnpm install + dev boot on Node 24 (P0.S2a-1 Task 3)

## Roadmap impact (see `docs/architecture/roadmap-impact.md`)
- README "Base" paragraph, CONTRIBUTING "Repository" bullets, P0.S1 (already applied), P0.S2b acceptance (`git diff <upstream tag> -- packages/` no longer applies), M.S1 (procedure and acceptance) follow Decision 7.
