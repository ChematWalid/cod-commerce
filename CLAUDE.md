# CLAUDE.md — rules for every session

This project builds a multi-store cash-on-delivery commerce SaaS for Algeria (functional clone of a reference product, **our own branding**) on **Vendure v3 (published `@vendure/*` packages, pinned) + a Next.js storefront**. Work is split into roadmap sessions; **one Claude session = one roadmap session = one branch = one PR**.

These rules are mandatory and override defaults. If a rule conflicts with a request, say so and ask.

## Where things are
| What | Path |
|---|---|
| Roadmap (phases, session table, dependencies, shared contracts) | `docs/roadmap/README.md` |
| Git/GitHub rules | `docs/roadmap/CONTRIBUTING.md` |
| Session briefs | `docs/roadmap/P{n}-<phase>.md` (section `P{n}.S{m}`) |
| Session plans | `docs/roadmap/plans/P{n}.S{m}-plan.md` |
| Handoff notes | `docs/roadmap/handoff/P{n}.S{m}.md` |
| Architecture & stack (follow it) | `docs/architecture/README.md`, `system-design.md`, `tech-stack.md`, `infrastructure.md` |
| Decisions | `docs/adr/` (drafts in `docs/adr/drafts/`) |
| What to build (source of truth) | `docs/feature-inventory.md`, `docs/research/*` — never re-research the reference product |

## 1. Start of every session (in order)
1. Identify the session ID (`P{n}.S{m}`). Read its brief, `docs/roadmap/CONTRIBUTING.md`, every file in the brief's "Read first", and the handoff notes of its prerequisites.
2. Check prerequisites are **merged** on the phase branch `phase/P{n}` (or on `main` for an earlier phase) (`gh pr list --state merged`); if not, stop and tell the user.
3. Branch from an up-to-date `phase/P{n}` (ADR 0018; `main` for work outside a phase): `git switch phase/P{n} && git pull --ff-only && git switch -c <branch from the brief>`. Look at its latest CI run (`gh run list --branch phase/P{n}`) and note an inherited red run in the handoff.
4. Show the task list (one item per plan task) before doing work.

## 2. Plan before code — and save the plan
1. Use the **`superpowers:writing-plans`** skill to expand the brief into an executable plan (exact files, commands, tests, verification, commit per task).
2. **Save it to `docs/roadmap/plans/P{n}.S{m}-plan.md`** (if a plan already exists there, read and follow it; update it instead of rewriting).
3. Add a line `- docs/roadmap/plans/P{n}.S{m}-plan.md (executable plan)` to the brief's "Read first" if missing.
4. **First commit of the session:** `docs(roadmap): plan P{n}.S{m}`.
5. If a decision is genuinely the user's (scope, money, external accounts, irreversible actions), ask before implementing.
6. **Every plan, for every session, must contain:**
   - a Global Constraints line "CLAUDE.md rules apply" plus the no-attribution rule;
   - the branch name and the session issue number;
   - one Conventional Commit per task;
   - a final task "End of session" with the steps of section 6 below (inventory ticks, handoff, push, PR, stop);
   - a verification section (tests, browser check where UI, multi-tenant check).
   This applies to plans written by any agent or subagent, not only the main session.

## 3. While implementing
- Execute the plan task by task (**`superpowers:executing-plans`**, or **`superpowers:subagent-driven-development`** for many independent tasks). Keep the task list updated.
- **Commit after every completed task/step** — small Conventional Commits (`feat(scope): …`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`); scope = plugin/app name. Each commit builds and passes its tests. Never one giant commit at the end.
- **Tests first** where logic exists (**`tdd-workflow`**): unit tests for services/pure logic, integration tests for every new endpoint, and a **multi-tenant isolation test** for every new entity/endpoint (business A never sees business B).
- UI work: check the screen in the browser against the matching flow in `docs/research/`. Screenshots and API transcripts go in `docs/evidence/<session-id>/` (§3a.14) and the PR links them.
- **Never edit Vendure core.** Everything lives in `plugins/<name>`, `apps/*`, `packages/shared`. A core fix is only allowed via a reviewed `pnpm patch` with a PR labelled `vendure-patch` (ADR 0001).
- Follow the shared contracts in `docs/roadmap/README.md` (owner session defines, others consume) and the architecture docs. Deviations → write them in the handoff and propose an ADR/roadmap change.
- Use **`superpowers:verification-before-completion`**: never claim something works without running it and showing the output.
- If the session will clearly not fit, stop at a clean commit, write the handoff, and propose a split (`P{n}.S{m}a/b`) per the roadmap's mutation protocol.

## 3a. Engineering principles (user, 2026-11-07)
Goal: adding or changing a feature touches one place and stays easy. These rules bind every session and are enforced by lint and tests where noted.
1. **Feature = plugin.** Each feature lives in `plugins/<name>/` with a fixed layout, copied from `plugins/_template`:
   - `domain/`: pure logic and types, no Nest, TypeORM or Vendure imports;
   - `application/`: use-case services;
   - `infrastructure/`: TypeORM, HTTP, queue and carrier adapters;
   - `api/`: GraphQL resolvers, REST controllers, DTOs;
   - `dashboard/`: the ADR 0010 path;
   - `tests/`.
2. **Dependency direction.** `api` → `application` → `domain`. `infrastructure` implements ports (interfaces) declared in `domain`/`application`. A plugin never imports another plugin's internals; it uses `packages/shared` contracts (types, event names, queue names) or domain events.
3. **Small, single-purpose units.** One reason to change per module; functions ≤ ~40 lines; files ≤ ~300 lines; early returns over nesting; no `utils`/`helpers` dumping grounds; no god services.
4. **Names over comments.** Comments explain *why* (business rule, workaround), never *what*. Public functions and endpoints get TSDoc.
5. **No magic values.** Constants live in `packages/shared` or the plugin's `domain/constants.ts`. Config is typed and schema-validated at boot, failing fast.
6. **Strong types.** No `any` (use `unknown` + narrowing). DTOs and types are named and reusable, not inline shapes. Immutable updates by default.
7. **Open for extension.** New carriers, payment methods, offer kinds, notification channels and spam rules are new adapters behind an existing port or registry, never a new branch in a shared `switch`.
8. **Errors are never silent.** No empty `catch`. Log with context through the structured logger, or rethrow a typed domain error. One error mapping per API surface.
9. **Tenant safety by construction.** Only `TenantRepository` / `tenantQuery` touch tenant tables (ADR 0002).
10. **Tests.**
    - Domain logic is unit-tested without Nest or the DB.
    - Every endpoint has an integration test.
    - Every entity or endpoint has a two-business isolation test.
    - Tests are named by behaviour and follow Arrange, Act, Assert.
11. **Enforced, not just written.** ESLint layer and boundary rules (`eslint-plugin-boundaries` or `import/no-restricted-paths`), `complexity`, `max-lines` and `max-lines-per-function`, plus an architecture test, all fail CI.
12. **Deviations are explicit.** Any exception to these rules needs an ADR or a dated note in the handoff, never a silent one.
13. **Workflow.**
    - Use subagents for independent work: research, parallel drafting, reviews.
    - A fresh agent reviews every plan before it is committed.
14. **Proof of working (user, 2026-11-07).** Beyond unit and integration tests, every session leaves evidence from real runs in `docs/evidence/<session-id>/`. Each session commits a re-runnable script (`scripts/evidence/<session-id>.*`) that produces it.
    - **UI:** Playwright screenshots of every new or changed screen, saved in `screens/`. Capture desktop and mobile, and Arabic RTL plus English where the screen is localized. PNGs stay ≤ ~300 KB.
    - **API:** a request/response transcript for every new endpoint, saved in `api/*.md`. Each transcript holds the method, URL, the relevant headers, the status, and the body.
    - **Rules:**
      - transcripts and screenshots come from a live server, never hand-written;
      - tokens, cookies and secrets are redacted;
      - data is synthetic, never real buyer data.
    - The PR links the folder.
15. **Meta-rule.** When the user states a lasting working principle, record it here via a `docs/claude-md-*` PR.
16. **Several frontends, one backend (user, 2026-11-08).** The website and the mobile apps for merchants and shoppers are clients of the same backend. Frontends hold no business rules; those live in plugins behind APIs (ADR 0017).
17. **Look at the evidence (user, 2026-11-08).** Before merging, open every new or changed screenshot and check it by eye: visible branding, untranslated strings, RTL alignment, broken layout. A passing script is not enough; report what you saw.
18. **Own branding is visible-surface work (user, 2026-11-08).** No third-party product name or logo on any screen a merchant or buyer sees, except a licence-required notice recorded in an ADR (currently the dashboard footer, ADR 0001 counsel question).
19. **Security sweep before every merge (user, 2026-11-08).** Check open Dependabot alerts and GitGuardian/GitHub security notifications. Fix a real leaked secret or a new high/critical alert first, and alert the user.

## 4. Git & GitHub (details in CONTRIBUTING.md)
- One branch per session; never push to `main`; never force-push. **Working agreement (user, 2026-11-07):** the agent squash-merges its own PR; anything that is the user's decision is asked as a multiple-choice question (the user is the decider).
- **Phase branches (user, 2026-11-13, ADR 0018):** from P2 on, session PRs target `phase/P{n}` and are squash-merged at once, without waiting for CI. CI runs on GitHub in the background on every PR and every push to `phase/P{n}`; a red run blocks nothing and is fixed forward in its own PR. Locally, run only lint, typecheck and unit tests of what changed. The phase ends with one `phase/P{n}` → `main` PR, merged only when fully green (CI and browser).
- PRs via `gh pr create` using `.github/pull_request_template.md`, title in Conventional Commits form, body with `Closes #<session issue>`.
- **No Claude attribution, ever:** no `Co-Authored-By: Claude …` trailer, no "Generated with Claude Code" line in commits, PR titles or bodies; never add Claude as a collaborator. (Enforced by `.claude/settings.json`, `.githooks/commit-msg`, and the CI `attribution-check`.) Don't bypass hooks (`--no-verify`).
- Commits are authored by the user's identity (`ChematWalid`).

## 5. Secrets, accounts and safety
- **Never handle tokens or passwords.** For `gh auth login`, carrier/payment/ad/AI keys, the user does it. Secrets go in `.env` (git-ignored) or GitHub Actions secrets; only `.env.example` with placeholders is committed.
- External integrations use mocks/sandboxes until the user provides credentials (see the credentials table in `docs/roadmap/README.md`).
- The **real** reference-product account is read-only forever; any hands-on testing uses the user's **test** account only.
- Ask before outward-facing or irreversible actions (creating/deleting repos, changing GitHub settings outside the session's scope, sending messages, paying).

## 6. End of every session (in this order — do not skip)
1. Tick the `docs/feature-inventory.md` rows the session fully completed and verified (for rows split across sessions, only the last session ticks).
2. Write **`docs/roadmap/handoff/P{n}.S{m}.md`**: what was done, decisions made, deviations from the plan/brief, what is left, gotchas, commands to run it.
3. Make sure the plan file reflects what was actually done (tick its checkboxes).
4. Commit `docs(roadmap): handoff P{n}.S{m}` → `git push -u origin <branch>` → `gh pr create`.
5. Open the PR against `phase/P{n}` (`gh pr create --base phase/P{n}`) and squash-merge it at once, without waiting for CI (§4, ADR 0018). A later red run is fixed forward in a new PR.
6. Report the PR link and a short summary to the user. Ask the user (multiple choice) to accept any new ADRs. The phase-end PR `phase/P{n}` → `main` is the exception: wait for CI (`gh pr checks --watch`) and the browser run, and merge only when all are green.

## 7. Environment
- Arch Linux, zsh, native Docker (moved from Windows 11 on 2026-11-07). The interactive shell aliases `sed`, `cut`, `tr`, `grep`, `cat` and `ls` to other tools: in agent commands use `command <tool>` or a `bash` script. Never `pkill -f`/`kill $(pgrep -f …)` with a pattern that appears in your own command line.
- Bash scripts and hooks use **LF** line endings and are committed with the exec bit (`git update-index --chmod=+x`).
- Node 24 (`~/.mise/installs/node/24.22.1/bin`; the host default is Node 26); package manager and scripts are defined in P0.S2b (see root `README.md`).
- Use `gh … --jq` instead of `jq`.

## 8. Changing the roadmap or these rules
- Roadmap changes (split/insert/skip sessions, dependency changes) go through their own PR on a `docs/roadmap-<change>` branch.
- Changes to this file go through a PR too; keep it short and imperative.
