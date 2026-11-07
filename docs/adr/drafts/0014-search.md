# ADR-0014: Search (storefront catalog and dashboard lookup)

**Date**: 2026-11-07
**Status**: Proposed (new; spike E "Arabic search" is a precondition)
**Deciders**: architect (draft), user

## Context

- Storefront search (`/store/product/search`) runs per store over a small catalog (typically tens to a few thousand products). Dashboard search covers orders (number, customer name, phone, product), customers and products [feature-inventory §3, §4, §7].
- Languages: Arabic (MSA and Darija in Arabic script), French, and Darija in Latin script ("arabizi"), mixed-script queries [EH §10].
- `DefaultSearchPlugin` with `PostgresSearchStrategy` covers small and medium catalogs. Arabic tokenisation is UNVERIFIED. Elasticsearch is a community plugin. Typesense is paid. Meilisearch has only a third-party plugin of unknown maintenance [VN §5].
- Postgres has no built-in Arabic stemmer. Meilisearch's Charabia normalises Arabic (article segmentation, diacritics, tatweel, alef/yeh/teh-marbuta). Typesense uses ICU. Meilisearch Cloud costs about $23+/mo [EH §10].

## Options

1. **Vendure DefaultSearchPlugin as-is**: unknown Arabic quality and its index is per language/channel. Kept for the admin product list only.
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
- Ranking: exact token > prefix > trigram similarity (`similarity() > 0.3`), plus a popularity boost (orders in the last 30 d).
- Queries always filter by store (storefront) or business (dashboard). No cross-tenant index exists.
- Order lookup: exact match on `order_number` and `phone_e164` first (B-tree), then the trigram on name/product.

**Phase 2 (trigger-based): self-hosted Meilisearch** for **storefront** search when any of these holds:
- spike E or production relevance (zero-result rate above 15 % or click-through below a target) fails for Arabic/Darija;
- any store exceeds 20 k products;
- storefront search p95 exceeds 150 ms.

Setup: one index per environment with `storeId` as a filterable attribute and tenant tokens (search keys restricted by filter), fed from the outbox (`product.changed`). Postgres stays the source of truth and the dashboard search. A droplet or DOKS pod at ~$24/mo [EH §4 DO 2 vCPU/4 GB].

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
- **Latin-script Darija recall.** Mitigation: a synonym table per business (merchant-editable later) and the Phase 2 trigger.
