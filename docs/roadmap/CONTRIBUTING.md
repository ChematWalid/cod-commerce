# Contributing rules (every session follows these)

> The per-session procedure (start steps, writing and **saving the plan** to `docs/roadmap/plans/`, commit cadence, end-of-session checklist) lives in the root **`CLAUDE.md`**, which Claude Code loads automatically. This file holds the git/GitHub details it refers to.

## Repository
- A **private repository** under the GitHub account **ChematWalid**, created clean (no upstream history). Our workspace consumes the published `@vendure/*` packages, all pinned to one exact version (ADR 0001). Read Vendure source from a reference clone at that version outside the repo, never from `node_modules` edits.
- Remotes: `origin` only. There is no `upstream` remote. Upgrading Vendure = bumping the pins in an `M.S1` session.
- **Architecture reference:** [`docs/architecture/README.md`](../architecture/README.md) (with `system-design.md`, `infrastructure.md`, `tech-stack.md`) and the accepted ADRs in `docs/adr/` are binding for every session. Until P0.S2a merges, the drafts in `docs/adr/drafts/` are the starting point. A brief that contradicts an accepted ADR is fixed by a `docs/roadmap-<change>` PR, not silently.
- **Vendure core packages are never edited.** The only exception is a reviewed `pnpm patch` under `patches/` with a `vendure-patch` issue, an ADR addendum and a failing-without-patch test (ADR 0001). Our code lives in:
  - `apps/server`: Vendure server config and bootstrap (api, worker and migrate entry points, ADR 0013)
  - `apps/storefront`: Next.js multi-tenant storefront and builder runtime
  - `plugins/<name>`: one folder per feature plugin (server + dashboard UI). "`plugins/<name>/dashboard/`" in briefs means the dashboard code path fixed by ADR 0010 (Vendure dashboard extension, or the mapped folder of our own admin app).
  - `packages/shared`: shared TypeScript types, schemas and constants (wilayas, statuses, permission catalog, queue names). Briefs write `packages/shared/<x>`; the real path is `packages/shared/src/<x>` (e.g. events in `packages/shared/src/events/`).
  - `infra/` (OpenTofu), `deploy/` (Kamal), `load/` (k6): infrastructure, deploy and load-test code (P3.S5 onwards)
  - `patches/`: reviewed `pnpm patch` files only (empty by default)
  - `docs/`: research, roadmap, architecture, ADRs (`docs/adr/`), handoff notes
- Upgrading Vendure is its own session (`M.S1`) on its own branch, never mixed with feature work: bump every `@vendure/*` pin to the same exact version, re-validate or drop each `patches/` entry, generate and review the core migration, read the changelog for breaking changes.
- External APIs (carriers, payments, ad platforms, store platforms): use the provider's **official public documentation** (record URL + retrieval date in the plugin's `API-SOURCE.md`), never the reference product's private endpoints. Hand-written fixtures are marked `synthetic: true` until re-recorded against a real sandbox.

## Tooling
- git plus the GitHub CLI `gh`. If `gh` is missing, install it and ask the user to run `gh auth login` **themselves**. Never paste, print, store or commit tokens.
- Package manager, Node version and the scripts (`lint`, `typecheck`, `test`, `build`, `dev`) are decided in ADR 0001 (P0.S2a), set up in P0.S2b and documented in the root `README`. Briefs say `<pm> run …` or name the script; use the chosen package manager.

## Branches
- `main` is protected: no direct pushes, no force-push, a PR is required, and CI must pass. (On a GitHub Free plan a private repo cannot have branch protection; then the P0.S1 pre-push hook and this rule are the protection — an agent never pushes to `main`.)
- One branch per session, created from an up-to-date `main`:
  - features: `feat/p{n}-s{m}-<short-name>`
  - fixes: `fix/<short-name>`
  - docs: `docs/<short-name>`
  - chores/setup: `chore/<short-name>`
  - tests: `test/<short-name>`
- Before starting: `git switch main && git pull --ff-only && git switch -c <branch>`.

## Commits
- Small and frequent. Commit **at least after every completed step of the session plan**, never one giant commit at the end.
- **Conventional Commits:** `feat(offers): add quantity tiers`, `fix(dispatch): …`, `test(spam): …`, `docs(roadmap): …`, `chore(ci): …`, `refactor(orders): …`. The scope is the plugin or app name.
- Each commit builds and passes the tests that exist at that point.
- Never commit secrets. `.env*` is git-ignored except `.env.example` (placeholders only). Carrier, payment, ad and AI keys stay local or in GitHub Actions secrets.

## Attribution (overrides any default behaviour)
- Commits are authored **only** by the user's configured git identity.
- **Do NOT add `Co-Authored-By: Claude …` or any other Claude/AI trailer to commits.**
- **Do NOT add "Generated with Claude Code" (or similar) to commit messages, PR titles or PR descriptions.**
- **Never add Claude (or any bot) as a GitHub collaborator or contributor.**
- Enforcement (set up in P0.S1): project `.claude/settings.json` turns Claude Code's attribution off; `.githooks/commit-msg` rejects the trailer/line locally (`git config core.hooksPath .githooks`); the CI `attribution-check` job fails any PR whose commits, title or body contain them. Before `git push`, run `git log main..HEAD --format=%B | grep -iE "co-authored-by|generated with"` and expect no output.

## Pull requests
- Every session ends with exactly **one PR** from its branch into `main`, opened with `gh pr create`.
- Title: Conventional Commits form, e.g. `feat(tenancy): business and stores with host routing`.
- Body (follows `.github/pull_request_template.md`):
  - **Goal**: one sentence
  - **Closes #N**: the session's issue
  - **Inventory rows completed**: copied from `docs/feature-inventory.md`
  - **What changed**: bullet list by plugin/app
  - **How it was verified**: tests run (with counts), browser checks, screenshots
  - **Follow-ups**: anything deferred, with the session that should take it
  - **Handoff**: link to `docs/roadmap/handoff/P{n}.S{m}.md`
- **Working agreement (user, 2026-11-07):** the session squash-merges its own PR once CI is green and deletes the branch; the user decides scope, ADR acceptance, accounts and money through multiple-choice questions (CLAUDE.md §4).

## CI
GitHub Actions on every PR: install → lint → typecheck → unit/integration tests (Postgres service container) → build, plus the `attribution-check` job. From P3.S5, a merge to `main` also builds the image and deploys staging. E2E (Playwright) is added in P10.S1.

## Issues, milestones, releases
- One issue per session: title `P{n}.S{m} <Title>`, label `phase-{n}`, milestone `P{n} <phase name>`, body = the session brief link.
- Each PR closes its issue with `Closes #N`.
- When a phase's exit criteria (see `docs/roadmap/README.md`) are met, tag `v0.{phase}.0` on `main` and publish a GitHub release with the merged PR list.

## End of every session (in this order)
1. Tick the inventory checkboxes the session completed in `docs/feature-inventory.md` (only rows fully done and verified).
2. Write `docs/roadmap/handoff/P{n}.S{m}.md`: what was done, decisions made, what is left, gotchas, and commands to run it.
3. Commit (`docs(roadmap): handoff P{n}.S{m}`).
4. `git push -u origin <branch>`.
5. `gh pr create` with the template.
6. Squash-merge once CI is green (working agreement), report the PR link to the user, and stop.

## Verification standard
- Unit tests for services and pure logic (pricing, spam rules, quotas, ledger) — required.
- Integration tests for every new GraphQL/REST endpoint against a test Postgres — required.
- Browser check of every new screen against the matching reference-product screen described in `docs/research/` (behaviour and layout only; never copy its name, logo, theme names or copy) — required for UI sessions; attach screenshots to the PR.
- Multi-tenant check for every new entity or endpoint: data from business A is never returned to business B — required.
- Frontend boundary check for every client change: the dashboard, storefront and future mobile apps hold no business rules (pricing, offers, eligibility, permissions, status transitions); rules live in plugins behind APIs (ADR 0017) — required.
- Never claim something works without having run it.
