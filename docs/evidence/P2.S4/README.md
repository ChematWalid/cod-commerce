# Evidence for P2.S4 (pricing and offer engine core)

Transcripts from a live stack (CLAUDE.md §3a.14, D2432), produced by `scripts/evidence/P2.S4.sh`. The compose project
`cod-evidence` migrates the database and boots the api with the offers plugin (`/readyz` 200); the demo seed adds two
synthetic businesses; the script adds four products in store A1 (one at 4,900 DZD with a red and a blue variant, one for
the schedule cases, one for the codes, one draft) and one in business B over the catalog Admin API. Then
`scripts/evidence/P2.S4-quote.ts` boots the server's Vendure app on the host against the stack's database, seeds the offers
and codes through `OfferAdminService`, registers a synthetic fee table (home 800, stop desk 500, Algiers) on
`SHIPPING_QUOTE_REGISTRAR` and calls the scoped `PricingService` core on each store's own channel (D2408). There is no
pricing HTTP route before P3.S3, so each transcript shows the in-process call, its input and its output: no status line,
no headers. Image built from a tree with no uncommitted change outside the evidence folders and browser tests, last
image-relevant commit `71336866e1ebf07f0cc3e8498ee4f971ca5fe10f`. No screenshots: P2.S4 has no screen.

Offers of store A1: a quantity offer on the 4,900 product (2 pieces 10 % off, 3 pieces 15 % off with free delivery; the
15 % is the fixture assumption of the research's elided figure), two product discounts outside their schedule, two code
offers on the codes product (`WELCOME10` 10 %, `USEDUP15` 15 % with a usage limit of 1 already reached) and two order
discounts by code that do not combine (`ORDER10` 10 %, `SAVE1000` 1,000 DZD). Business B has one code offer
(`BONLY20`).

| File | Shows |
| --- | --- |
| [`api/quote-1-piece-home.md`](api/quote-1-piece-home.md) | 4,900 + 800 = 5,700; nudge: 1 more unit saves 980 (AC1, AC2) |
| [`api/quote-2-pieces-home.md`](api/quote-2-pieces-home.md) | red + blue count as 2 pieces: 8,820 + 800 = 9,620 (AC1, D2410) |
| [`api/quote-3-pieces-free-delivery.md`](api/quote-3-pieces-free-delivery.md) | 3 × 4,165 = 12,495, delivery waived, no nudge at the top tier |
| [`api/quote-desk.md`](api/quote-desk.md) | one piece to a stop desk: 5,400 |
| [`api/quote-schedule-skipped.md`](api/quote-schedule-skipped.md) | `skipped`: `not_started` and `ended` (AC3) |
| [`api/quote-codes.md`](api/quote-codes.md) | `WELCOME10` applied; `duplicate`, `not_found`, `code_limit` rejected (AC4) |
| [`api/quote-not-combinable.md`](api/quote-not-combinable.md) | two order discounts that do not combine: 1,000 applies, 10 % rejected `not_combinable` (AC5) |
| [`api/quote-unavailable-variant.md`](api/quote-unavailable-variant.md) | a draft product's variant: `available: false`, no token (D2425) |
| [`api/verify-round-trip.md`](api/verify-round-trip.md) | the 2-piece token with its cart: `ok` (AC7) |
| [`api/verify-tampered-total.md`](api/verify-tampered-total.md) | total rewritten in the payload: `bad_signature` |
| [`api/verify-other-store.md`](api/verify-other-store.md) | A1's token in store A2: `store_mismatch` |
| [`api/verify-expired.md`](api/verify-expired.md) | the plugin's clock set to the token's `exp`: `expired` |
| [`api/reprice-1-to-2.md`](api/reprice-1-to-2.md) | an order of 1 piece changed to 2: 5,700 → 9,620, delta 3,920 (D2427) |
| [`api/isolation-b-code-in-a.md`](api/isolation-b-code-in-a.md) | business B's code in store A1: `not_found`, no B offer in the quote |

Every number above is asserted by `P2.S4-quote.ts` before its transcript is written. Business, store and offer ids are
placeholders (`<STORE_A1>`, `<OFFER_QUANTITY>`, …); product and variant ids are the engine's small integers. Each
`quoteToken` is cut to `qt1.<payload>.[REDACTED]` by the script (the payload is what the token commits to; its base64url
still holds the real ids). `P2.S4.sh` refuses to finish when a token signature (`qt1.<payload>.<20+ base64url chars>`),
a key, a password, a session or channel token, or a banned name appears here.
