# ADR-0001: Repo layout and upstream (build from source vs published `@vendure/*` packages)

**Date**: 2026-11-07
**Status**: Proposed (draft for P0.S2a; the user confirms in the P0.S2a PR review)
**Deciders**: architect (draft), user (confirmation)

Citation keys: [VN §n] = `docs/architecture/research/vendure-v3.md` section n; [EH §n] = `docs/architecture/research/edge-hosting-costs.md` section n; [BK] = background knowledge, verify before relying on it.

## Context

- The roadmap currently seeds a private repository from `vendurehq/vendure` history with an `upstream` remote (README "Base", P0.S1 step 2) and leaves "build from source vs published packages" to this ADR.
- Vendure's documented path is `npx @vendure/create` plus the published `@vendure/*` npm packages, all bumped to the same version on upgrade [VN §8, https://docs.vendure.io/current/core/developer-guide/updating].
- Our hard rule is already "core is never modified": every feature is a plugin [repo-evaluation.md "Recommendation"]. Building core from source gives us nothing we are allowed to use.
- Vendure ships roughly quarterly minors that still contain breaking items (3.8.0: NestJS 12, Apollo Server 5, an order-line promotion data migration, a `ctx.session.token` type change) [VN §8, https://docs.vendure.io/changelog?focus=v3.8.0].
- Licence: GPLv3 or commercial. Changes to the framework must be GPLv3. `plugin-exception.txt` lets plugins use another licence. Hosting a SaaS is not "distribution" under GPLv3 [VN §8, https://raw.githubusercontent.com/vendurehq/vendure/HEAD/license/license-faq.md].
- CI time matters: 62+ agent sessions each end in a PR. The upstream monorepo builds dozens of packages and ships its own workflows, which would have to stay disabled (P0.S1 "GitHub facts").

## Options

### A. Build inside the upstream monorepo (core built from source)
- **Pros**: a core bug can be patched in place; upstream source sits next to our code.
- **Cons**: the root `package.json` and lockfile are shared with upstream, so every M.S1 sync is a merge with conflicts. CI must build core (est. 10–20 min more per PR [BK]). Upstream workflows must be re-disabled after every sync. Editing core is easy and forbidden, so any edit is a GPL-scope and upgrade hazard.
- **Why not**: it pays the full cost of a fork for a capability (core edits) we have banned.

### B. Same repo seeded from upstream history, but our workspace consumes the published packages
- **Pros**: upstream source stays one `git log` away; the published packages keep CI fast.
- **Cons**: two "truths" in one repo: upstream `packages/*` (which nobody builds) and the npm versions we actually run. They drift unless M.S1 does both a merge and a bump. Upstream files confuse search, lint and agents (wrong `packages/` hits), and upstream workflows still need disabling.
- **Why not**: we pay for the mirror and get only reading convenience. A pinned reference checkout outside the repo gives the same thing.

### C. Clean private app repo on the published `@vendure/*` packages, with patching as a controlled escape hatch (recommended)
- **Pros**: this is the documented Vendure path. CI builds only our code. An upgrade is "bump every `@vendure/*` to X.Y.Z, regenerate migrations, fix types". No upstream workflows. Licence scope stays clean: core is untouched npm, our code is plugins.
- **Cons**: core cannot be patched by editing source. Mitigation: `pnpm patch` (the built-in equivalent of patch-package) for an emergency fix, with rules (below). Upstream source is not in the repo. Mitigation: a read-only reference clone at the pinned tag outside the repo, or the `docs/` folder of the tag on GitHub.

## Decision

We adopt **Option C**.

1. **Repository**: a new private repo `ChematWalid/<repo>` with no upstream history and no `upstream` remote. Vendure source for reading is a shallow clone at the pinned tag outside the repo (`%USERPROFILE%/src/vendure@3.8.x`) or GitHub links at the tag.
2. **Dependencies**: every `@vendure/*` package is pinned to one **exact** version (no `^`/`~`), currently the latest 3.8 patch. Renovate or Dependabot may propose minors, but only M.S1 merges them.
3. **Package manager and runtime**: pnpm 10 workspaces with Turborepo task caching. Node.js 24 LTS if Vendure 3.8's support matrix lists it (P0.S2a verifies), otherwise Node 22 LTS with a planned bump before Node 22 end-of-life (2027-04-30) [BK]. `packageManager` is pinned in the root `package.json`.
4. **Layout**:
   ```
   apps/server        Vendure bootstrap: api, worker, migrate entry points (one image, ADR 0013)
   apps/storefront    Next.js 16 storefront, builder preview, marketing and sign-up pages (ADR 0006)
   plugins/<name>     one Vendure plugin per module; dashboard code in plugins/<name>/dashboard/ (ADR 0010)
   packages/shared    zod schemas, constants (wilayas, statuses, permissions), domain event names, queue names
   packages/config    eslint/tsconfig/vitest presets
   infra/             OpenTofu (ADR 0011); deploy/ = Kamal config (ADR 0013)
   load/              k6 scripts; docs/ = research, roadmap, architecture, adr
   ```
5. **Escape hatch (patching core)**: allowed only through `pnpm patch @vendure/<pkg>@<exact>`, committed under `patches/`. Each patch needs (a) a GitHub issue labelled `vendure-patch` linking the upstream issue or PR, (b) a short ADR addendum, (c) a test that fails without the patch. M.S1 must drop or re-validate every patch. Patches are GPLv3 modifications, so a patch file never contains our proprietary logic. Default stance: fix it in a plugin or strategy override first.
6. **CI time budget**: PR pipeline at most 12 min wall-clock (lint + typecheck + unit + integration on a Postgres service + build, with Turborepo remote/GHA cache). E2E Playwright runs on merge to `main` and nightly, at most 20 min.
7. **M.S1 procedure (replaces "merge the upstream tag")**: read the release notes and migration guide → bump all `@vendure/*` pins in one commit → `pnpm install` → re-apply or drop `patches/` → `npx vendure migrate --generate vendure-<version>` and review the core migration → adapt plugins → full suite + E2E → ADR addendum `docs/adr/NNNN-upstream-sync-<version>.md` [VN §8, §9].
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
- **pnpm strictness vs NestJS/TypeORM peer deps or the dashboard Vite plugin.** Mitigation: P0.S2b tries pnpm first. If resolution breaks, set `node-linker=hoisted`. If that still fails, fall back to npm workspaces + patch-package, and record which in the handoff.
- **Breaking minors.** Mitigation: exact pins, a dedicated M.S1 session per minor, staging soak before production.

## Roadmap impact (proposed; see `docs/architecture/roadmap-impact.md`)
- README "Base" paragraph, CONTRIBUTING "Repository" bullets, P0.S1 (goal, GitHub facts, step 2, deliverables, acceptance), P0.S2b acceptance (`git diff <upstream tag> -- packages/` no longer applies), M.S1 (procedure and acceptance) all change.
