# ADR-0007: Branding (own name, no reference-product identity)

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect, user (product name)

## Context

- We build a **functional** clone of a reference product with **our own branding** (CLAUDE.md). Functionality is studied in `docs/feature-inventory.md` and `docs/research/*`; names, logos, theme names, designs and copy are the reference owner's and must not be reused.
- The research docs necessarily name the reference product; application code, catalogues, seeds, themes and user-facing text must not.
- No product name has been chosen yet. Architecture docs use the placeholders "Platform" and `ourdomain`; the repo is `ChematWalid/cod-commerce`.
- Copy keys and theme ids leak into URLs, CSS classes, database values and catalogues, so a later rename is expensive unless they are neutral from the start.

## Options

1. **Pick the final name now**: avoids a rename, but naming is a business and trademark decision the user has not made.
2. **Neutral working name + placeholders + an automated check (recommended)**: work proceeds; the real name is one configuration change later.
3. **No rule, clean up before launch**: cheapest now, but reference wording and theme names spread through seeds, tests and catalogues and are hard to find later.

## Decision

Option 2.

1. **Working name: "CodShop" (placeholder).** The real product name and root domain are **the user's decision**. Until then:
   - user-facing text reads the name from one constant (`packages/shared/brand.ts`: `PRODUCT_NAME`, `ROOT_DOMAIN`, support email), never a literal;
   - docs keep the placeholders "Platform" / `ourdomain`;
   - package scopes and identifiers use neutral technical names (e.g. `packages/shared`, `plugins/tenancy`; the npm scope is chosen in P0.S2b), not the working name, so the rename touches only `brand.ts`, assets and the domain config.
2. **Banned in `apps/`, `plugins/`, `packages/shared` (code, catalogues, seeds, fixtures, assets, theme presets)**:
   - the reference product's names: **Tassyir**, **Tassya** (any case, also inside identifiers, domains such as `tassyir.io`, cookie or storage prefixes derived from them);
   - its logo and any derived artwork;
   - its theme names: **Nocturne, Merino, Linden, Focal, Majestic, Impulse, Studio, Volta**;
   - its copy (marketing text, UI strings, onboarding text, email/SMS templates), its designs and its screenshots.
   Our own theme presets get their own names (P8.S6).
3. **Neutral copy keys**: catalogue keys name the function (`checkout.submit`, `orderStatus.confirmed`), never the reference wording; every string is written fresh (ADR 0005).
4. **Automated check (P0.S2b adds it, CI runs it on every PR)**: `scripts/check-branding.sh` greps `apps/`, `plugins/`, `packages/shared`:
   - product names: case-insensitive substring `tassyir|tassya`;
   - theme names: case-sensitive whole word `\b(Nocturne|Merino|Linden|Focal|Majestic|Impulse|Studio|Volta)\b` (case-sensitive and whole-word because "studio" and "impulse" are ordinary words);
   - a match fails CI; a reviewed false positive goes into `.branding-allow` (path + line pattern + reason), changed only in a PR the user reviews.
   `docs/` is excluded (the research must name its subject); this ADR is the only ADR that lists the banned names.
5. **Repo rename** after the user picks the name: rename `ChematWalid/cod-commerce` on GitHub (GitHub redirects the old URL for clones, fetches and links), then update `git remote set-url origin`, the root README and `brand.ts` in one PR.

## Consequences

### Positive
- No reference identity in anything we ship; the check makes the rule enforceable by agents and CI.
- Choosing the real name later is a small, mechanical PR.

### Negative
- A placeholder name appears in screenshots and staging until the user decides.
- The theme-name check can flag ordinary words and needs an allow-list.

### Risks
- **Copy paraphrased too closely from the reference** passes the grep. Mitigation: write copy from the feature inventory's functional description, not from captures; reviewers check catalogue PRs.
- **Trademark conflict with the final name.** Mitigation: the user runs a trademark search before the rename (outside this repo's scope).
