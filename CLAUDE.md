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
2. Check prerequisites are **merged** on `main` (`gh pr list --state merged`); if not, stop and tell the user.
3. Branch from an up-to-date `main`: `git switch main && git pull --ff-only && git switch -c <branch from the brief>`.
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
- UI work: check the screen in the browser against the matching flow in `docs/research/`; attach screenshots to the PR.
- **Never edit Vendure core.** Everything lives in `plugins/<name>`, `apps/*`, `packages/shared`. A core fix is only allowed via a reviewed `pnpm patch` with a PR labelled `vendure-patch` (ADR 0001).
- Follow the shared contracts in `docs/roadmap/README.md` (owner session defines, others consume) and the architecture docs. Deviations → write them in the handoff and propose an ADR/roadmap change.
- Use **`superpowers:verification-before-completion`**: never claim something works without running it and showing the output.
- If the session will clearly not fit, stop at a clean commit, write the handoff, and propose a split (`P{n}.S{m}a/b`) per the roadmap's mutation protocol.

## 4. Git & GitHub (details in CONTRIBUTING.md)
- One branch per session; never push to `main`; never force-push; never merge PRs — **the user reviews and squash-merges**.
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
5. Wait for CI (`gh pr checks --watch`); fix failures with new commits.
6. Report the PR link and a short summary to the user, then **stop. Do not merge.**

## 7. Environment
- Windows 11; PowerShell and Git Bash. Bash scripts and hooks must use **LF** line endings and be committed with the exec bit (`git update-index --chmod=+x`).
- Node 24; package manager and scripts are defined in P0.S2b (see root `README.md`).
- Use `gh … --jq` instead of `jq`. After installing tools with `winget`, open a new terminal.

## 8. Changing the roadmap or these rules
- Roadmap changes (split/insert/skip sessions, dependency changes) go through their own PR on a `docs/roadmap-<change>` branch.
- Changes to this file go through a PR too; keep it short and imperative.
