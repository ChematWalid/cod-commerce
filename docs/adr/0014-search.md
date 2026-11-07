# ADR-0014: Search (storefront catalog and dashboard lookup)

**Date**: 2026-11-07
**Status**: Proposed — spike E passed (Evidence, P0.S2a-3); the user confirms in review
**Deciders**: architect (draft), user

## Context

- Storefront search (`/store/product/search`) runs per store over a small catalog (typically tens to a few thousand products). Dashboard search covers orders (number, customer name, phone, product), customers and products [feature-inventory §3, §4, §7].
- Languages: Arabic (MSA and Darija in Arabic script), French, and Darija in Latin script ("arabizi"), mixed-script queries [EH §10].
- `DefaultSearchPlugin` with `PostgresSearchStrategy` covers small and medium catalogs. **Spike E: it is not usable for Arabic** (recall@5 0.244): it uses `to_tsvector` with the server default config (`english`), prefix terms joined by AND, no Arabic or accent normalisation, and terms of 3+ characters only. Elasticsearch is a community plugin. Typesense is paid. Meilisearch has only a third-party plugin of unknown maintenance [VN §5].
- Postgres has no built-in Arabic stemmer. Meilisearch's Charabia tokeniser folds tashkeel, أ/إ/آ, ة/ه and ى/ي (spike E: every pair hits even with typo tolerance off). Typesense uses ICU. Meilisearch Cloud costs about $23+/mo [EH §10].

## Options

1. **Vendure DefaultSearchPlugin as-is**: recall@5 0.244 on the spike E set. Not used for storefront or dashboard search; Vendure's admin product list keeps it for staff only.
2. **Postgres with our own Arabic/French normalisation + `pg_trgm` (recommended first).**
3. **Meilisearch (self-hosted) from day one**: good Arabic normalisation, but another stateful service to run, sync and secure per tenant.
4. **Elasticsearch/OpenSearch**: has an `arabic` analyzer [?], but it is the heaviest to run. Reserved for the Scale tier if Meilisearch falls short.

## Decision

**Phase 1 (Launch): Postgres.**
- A `search_text` column on `storefront_product` (our per-store projection) and on `cod_order`/`customer_profile`, built by `normalizeForSearch()` in `packages/shared`:
  - lowercase; NFKC; strip Arabic diacritics (U+064B–U+065F, U+0670) and tatweel (U+0640);
  - normalise alef forms (أ إ آ ٱ → ا), ى → ي, ة → ه, ؤ → و, ئ → ي;
  - map Arabic-Indic and Eastern digits to ASCII;
  - drop the "ال" prefix as a second token variant;
  - `unaccent` for French; collapse whitespace;
  - phone digits normalised (05xxxxxxxx ↔ +2135xxxxxxxx).
- Indexes: `GIN (search_text gin_trgm_ops)`, combined with `business_id`/`store_id` through `btree_gin`, plus `to_tsvector('simple', search_text)` for whole-token matching.
- Ranking: exact token > prefix > trigram match, plus a popularity boost (orders in the last 30 d). **Matching uses `word_similarity` (`<%`) on the normalised text, with "ال" stripped from query words longer than 4 letters** (variant (b″) in spike E: recall@5 0.947, MRR 1.000). Plain `similarity()` (`%`) penalises short queries against long names ("sabbat" vs "Sabbat sport style running"); `word_similarity` alone misses "+ال" queries without the stripping. The "ال" guard keeps words such as "الة" (آلة) intact.
- `unaccent` is not IMMUTABLE: `normalizeForSearch` in SQL wraps it with an explicit dictionary inside an IMMUTABLE function so it can feed an index; the TypeScript and SQL normalisers share one test table (spike E pairs).
- Queries always filter by store (storefront) or business (dashboard). No cross-tenant index exists.
- Order lookup: exact match on `order_number` and `phone_e164` first (B-tree), then the trigram on name/product.

**Phase 2 (trigger-based): self-hosted Meilisearch** for **storefront** search when any of these holds:
- production relevance (zero-result rate above 15 % or click-through below a target) fails for Arabic/Darija (spike E passed: Phase 1 is accepted);
- any store exceeds 20 k products;
- storefront search p95 exceeds 150 ms.

Setup: one index per environment with `storeId` as a filterable attribute and tenant tokens (search keys restricted by filter), fed from the outbox (`product.changed`). **Set `localizedAttributes: [{ locales: ["ara"], attributePatterns: ["name", …] }]` on the index** (spike E: default settings missed plain Arabic queries such as "مكبر"; the per-query `locales` did not fix it). Postgres stays the source of truth and the dashboard search. Self-hosted on an Algerian VM (ADR 0011).

**Precondition: spike E "Arabic search" (P0.S2a)**:
- 300 real-looking product names across 3 stores (Arabic, French and Darija; mixed with/without diacritics, hamza variants, "ال", Latin Darija such as "jellaba", "tricot", "sabbat").
- 60 queries with expected results.
- Compare (a) Vendure DefaultSearchPlugin, (b) Phase 1 Postgres, (c) Meilisearch 1.x locally.
- Record recall@5, MRR and p95.
- Accept Phase 1 if recall@5 ≥ 0.85 and it is within 0.1 of Meilisearch.

## Consequences

### Positive
- No extra service at Launch. Search is tenant-safe by construction. Normalisation code is shared by storefront, dashboard and the spam engine (name matching).

### Negative
- We own the normalisation rules. Typo tolerance is weaker than Meilisearch's.

### Risks
- **Latin-script ↔ Arabic-script Darija** ("sabbat" vs "سبّاط") is a gap for every backend in spike E. Mitigation: a transliteration/synonym table per business (seeded with common Darija product words, merchant-editable later) applied to the query before matching; Meilisearch does not solve it either.
- **Small samples per variant pair** (1–5 queries each): the spike shows each fold works, not a precise rate. P2's storefront search session adds the zero-result-rate metric (ADR 0015) to watch real queries.

## Evidence

Spike E, 2026-11-07, P0.S2a-3. Scratch folder outside the repo, never committed. Vendure 3.8.1, Node 24.22.1, Postgres 17.11 (`pg_trgm`, `unaccent`, `pg_stat_statements`), Meilisearch 1.56.1.

**Fixture**:
- 300 products in 3 stores (clothing in Arabic; cosmetics and home in Arabic; electronics accessories in French with a few overlaps), with tashkeel/no tashkeel, hamza variants, ة/ه, ى/ي, with/without "ال", French accents and Latin-script Darija.
- 60 queries tagged by class: plain 6, diacritics 8, hamza 10, orthography (ة/ه, ى/ي) 10, article 8, French 7, Darija 7, typo 4.
- Expected ids by a fixed rule, not by hand: the same store, all of the query's concept tags, and the same script. Synonyms and translations do not count, except 2 Darija cross-script queries (reported with and without them).

**Backends**, each indexed per store:
- (a) Vendure `DefaultSearchPlugin` through the Shop API `search`;
- (b) Phase 1 Postgres as specified in the plan (normaliser + `pg_trgm` GIN, `%`/`similarity`);
- (b″) the Decision's variant (`word_similarity` + "ال" stripping);
- (c) Meilisearch, one index per store, default settings and with `localizedAttributes` ara.

**Latency**: 100 rounds × 60 queries after one discarded warm-up round, measured at each backend's own layer. The whole run was repeated from a stopped Vendure; relevance numbers were identical.

| Backend | recall@5 | MRR | p50 / p95 | Layer | Cross-store hits |
|---|---|---|---|---|---|
| (a) Vendure DefaultSearchPlugin | 0.244 | 0.317 | 11.9 / 17.9 ms (HTTP); 2.4 / 3.1 ms (strategy SQL) | Shop API / SQL | 0 |
| (b) Phase 1 Postgres, as specified | **0.878** | 0.933 | 1.8 / 2.2 ms | SQL | 0 |
| (b″) Phase 1 Postgres, Decision variant | **0.947** | 1.000 | 1.9 / 2.2 ms | SQL | 0 |
| (c) Meilisearch, default | **0.881** | 0.922 | 3.0 / 3.7 ms | HTTP | 0 |
| (c′) Meilisearch, `localizedAttributes` ara | 0.906 | 0.950 | 2.9 / 3.5 ms | HTTP | 0 |

**Acceptance rule**: (b) 0.878 ≥ 0.85, and 0.881 − 0.878 = 0.003 ≤ 0.1 (0.028 against the tuned Meilisearch index). **Phase 1 accepted.**

**Per variant pair** (queries with a hit in the top 5 / total): (a) Vendure, (b), (b″), (c) Meilisearch default, and Meilisearch with typo tolerance off ("no typo", which isolates normalisation from typo matching).

| Pair | (a) | (b) | (b″) | (c) | Meili no typo |
|---|---|---|---|---|---|
| tashkeel in query → plain name | 0/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| plain query → name with tashkeel | 0/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| أ→ا / ا→أ | 1/3, 0/1 | 3/3, 1/1 | 3/3, 1/1 | 3/3, 1/1 | 3/3, 1/1 |
| إ→ا / ا→إ | 1/3, 0/1 | 3/3, 1/1 | 3/3, 1/1 | 3/3, 1/1 | 3/3, 1/1 |
| آ→ا | 0/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| ة→ه / ه→ة | 1/3, 0/2 | 3/3, 2/2 | 3/3, 2/2 | 3/3, 2/2 | 3/3, 2/2 |
| ي→ى / ى→ي | 1/2, 0/3 | 2/2, 3/3 | 2/2, 3/3 | 2/2, 3/3 | 2/2, 3/3 |
| query drops "ال" / adds "ال" | 0/3, 0/5 | 3/3, 4/5 | 3/3, 5/5 | 3/3, 3/5 | 3/3, 3/5 |
| é→e / â→a | 1/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| Darija Latin spelling variants | 2/3 | 2/3 | 3/3 | 3/3 | 2/3 |
| Latin ↔ Arabic script | 2/2 (partial) | 1/2 | 2/2 (partial) | 2/2 (partial) | 2/2 |

**Gotchas**
- **Vendure indexing failed silently** at first: products are also assigned to the default channel, and with no tax zone on it every `update-search-index` job failed with `error.no-active-tax-zone`. Setting the default channel's zones and reindexing fixed it.
- Capturing Vendure's SQL needed `ALTER SYSTEM SET log_min_duration_statement=0` + `pg_reload_conf()`; an `ALTER DATABASE` setting did not reach the open pool connections.
- Meilisearch's typo tolerance does not apply to Arabic words under 5 characters (e.g. "قفطن").
