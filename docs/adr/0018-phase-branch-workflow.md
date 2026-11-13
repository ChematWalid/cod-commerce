# ADR-0018: Phase-branch workflow

**Date**: 2026-11-13
**Status**: Accepted (2026-11-13, user decision)
**Deciders**: user

## Context

- In P1 every session PR targeted `main` and waited for CI (`gh pr checks --watch`) before its squash-merge (CLAUDE.md §4 and §6, working agreement of 2026-11-07). ADR 0001 §6 sized the pipeline for this: every minute of CI is paid once per session.
- Sessions also ran the full suites locally before pushing. On the 12 GB development machine they serialised on one shared lock (`/tmp/cod-heavy-jobs.lock`), so parallel sessions queued behind each other's integration and browser runs.
- Waiting on CI and on the lock, not writing code, was the main bottleneck of P1: sessions finished their work and then sat idle, and every CI flake or slow job held up the next session that depended on the merge.
- `main` must still only ever hold code that passed CI and the browser tests.

## Options

1. **Keep per-PR CI gating on `main`** (the P1 flow). Every merge is green, but sessions keep waiting on CI and on the local lock. Rejected: it is the bottleneck this ADR removes.
2. **No CI until the end of the phase.** No waiting, but integration bugs pile up for weeks and surface all at once in the phase-end PR, when nobody remembers the change that caused them. Rejected.
3. **Phase branch: session PRs merge into `phase/Pn` at once, CI runs in the background on GitHub, the phase-end PR into `main` is the hard gate (chosen).**

## Decision

Option 3, from P2 on (P1 keeps its history and ends with its own PRs into `main`):

1. **Each session's PR targets the phase branch `phase/Pn`** (for example `phase/P2`), not `main`, and is merged immediately, without waiting for CI.
2. **CI still runs on every PR and on every push to the phase branch**, on GitHub's runners, in the background. `ci.yml` and `browser.yml` trigger on pushes to `phase/**` as well as `main`; `ci.yml` cancels superseded runs of a PR only, so each push to a phase branch keeps its own result. No session runs the full suites locally.
3. **A red CI run blocks nothing.** The next session, or a fixer session, repairs it in its own PR into `phase/Pn` while other work continues.
4. **The phase ends with one `phase/Pn → main` PR**, which must be fully green (CI and the browser tests) before it is merged. The browser workflow does not run on pull requests (ADR 0001 §6); the phase PR shows the browser run of its head commit, which is the phase branch tip.

The hard limits are unchanged: never push to `main` directly, never force-push, never `--no-verify`, no AI attribution.

## Consequences

### Positive
- Sessions no longer wait on CI or on the local lock; parallel sessions stop queueing on the 12 GB machine.
- `main` moves once per phase and only ever holds a fully green phase.
- CI still runs on every change, so an integration bug shows up on the run of the push that introduced it, not weeks later.

### Negative
- `phase/Pn` can be red for a while. A session can start from a red phase branch and must not mistake an inherited failure for its own.
- Integration bugs are caught by background CI and fixed forward in new PRs, not prevented at merge time.
- The phase-end PR is the hard gate, so everything left red in the phase must be fixed before the phase can land on `main`.

### Rules for sessions
- The coordinator creates `phase/Pn` from `main` when the phase starts. The pre-push hook refuses only `main`, so "never force-push" is what protects the phase branch.
- Branch from an up-to-date `phase/Pn` (not `main`) and open the PR with `--base phase/Pn`.
- Local checks are limited to lint, typecheck and unit tests of what the session changed. Integration, e2e and browser suites run on GitHub only.
- Before starting, look at the latest CI run on `phase/Pn` (`gh run list --branch phase/Pn`). A red run the session did not cause is noted in its handoff and fixed in a separate PR (by that session if it is small, or by a fixer session).
- ADR 0001 §6 still bounds the pipeline at 10 minutes; it now bounds background feedback time, not a session's wait.

## Alternatives rejected
- **Per-PR CI gating on `main`** (Option 1): keeps every merge green at the cost of the waiting that slowed P1.
- **No CI until phase end** (Option 2): removes the wait but loses early, per-change feedback and makes the phase-end PR a big-bang integration.
