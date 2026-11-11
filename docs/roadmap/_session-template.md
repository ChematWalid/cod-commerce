# Session brief template

Every session in the phase files uses exactly this structure. A fresh Claude session must be able to run it with no other context than this brief, the files it lists, and the repo.

---

## P{n}.S{m} — <Title>

| Field | Value |
|---|---|
| **Goal** | One sentence. |
| **Branch** | `feat/p{n}-s{m}-<short-name>` |
| **GitHub issue** | `P{n}.S{m} <Title>` (label `phase-{n}`, milestone `P{n} <phase name>`) |
| **Prerequisites** | Sessions whose PRs must be merged first. |
| **Parallel-safe** | Yes/No — with which sessions; **files/folders this session owns**. |
| **Model / size** | Opus or Sonnet · S / M / L |
| **External needs** | Credentials or accounts, and the mock used until they exist. |

**Inventory rows covered** (exact text from `docs/feature-inventory.md`; infrastructure sessions write "none (infrastructure)"):
- …

**Read first**
- `CLAUDE.md` (repo root — session procedure; auto-loaded) and `docs/roadmap/plans/P{n}.S{m}-plan.md` once it exists (the session writes and saves it first)
- `docs/roadmap/CONTRIBUTING.md`
- `docs/roadmap/handoff/<previous session>.md`
- Specific sections of `docs/research/*` (name the headings) and relevant ADRs in `docs/adr/`.
- Specific sections of `docs/architecture/*` (system-design, infrastructure, tech-stack) when the session touches queues, events, webhooks, caching, secrets or deployment.

**Audit issues to close** (only when open issues labelled `audit` name this session as owner; see CONTRIBUTING.md "Issues")
- #N <ID> (<severity>): <title>

**High-level plan** (4–8 steps; each step ends with a commit and is checkable — name the endpoint, screen, test or file it produces; the session expands this with the writing-plans skill before coding)
1. … → commit `feat(<scope>): …`
2. …

**Deliverables**
- Plugins / apps / files, GraphQL or REST endpoints, dashboard screens, storefront pages, jobs, migrations.

**Acceptance criteria** (testable; tied to Tassyir behaviour described in the research docs)
- [ ] …

**Verification**
- Tests to run (unit/integration) and expected results.
- Browser check: which screen, compared against which Tassyir screen/flow in `docs/research/`.
- Multi-tenant check.

**Out of scope**
- What this session must not touch, and which session owns it.

**Kickoff prompt** (paste into a fresh Claude session in the repo)
```
You are running session P{n}.S{m} "<Title>" of the roadmap in docs/roadmap/.
Follow CLAUDE.md at the repo root for every step. First write your plan with the writing-plans
skill, save it to docs/roadmap/plans/<this session ID>-plan.md (or follow it if it exists), commit it.
Read docs/roadmap/P{n}-<phase>.md (section P{n}.S{m}), docs/roadmap/CONTRIBUTING.md,
and the files listed under "Read first". Follow CONTRIBUTING.md exactly:
branch <branch> from an up-to-date main, small Conventional Commits after each step,
no Claude attribution in commits or PRs (no Co-Authored-By trailer, no "Generated with" line).
Use the writing-plans skill to expand the high-level plan, then implement it step by step,
verifying each step. Finish with the end-of-session checklist in CONTRIBUTING.md
(tick inventory rows, write the handoff note, commit, push, gh pr create), report the PR
link and stop without merging.
```

**Ends with** (from CONTRIBUTING.md): tick inventory rows → write `docs/roadmap/handoff/P{n}.S{m}.md` → commit → push → `gh pr create` → report PR link → stop.
