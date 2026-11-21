# Evidence for P2.S5 (offer kinds BXGY and add-on, offers admin)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P2.S5.sh`. Data is
synthetic: the demo seed's two businesses, plus what the script creates in store A1 (`demo`, Arabic) over the catalog
Admin API (a product at 4,900 DZD and an add-on product at 1,500 DZD) and over the offers API. Image built from a tree
with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit `46b91c5cb75d807bb58d530c9de5385cf94c093b`.
Compose project `cod-evidence`.

## API transcripts

Every offers endpoint is shown over REST (status codes per D2520) and, where it adds something, over GraphQL.

| File | Shows |
| --- | --- |
| [`api/app-types.md`](api/app-types.md) | `GET /offers/app-types` and `offerAppTypes`: the seven cards of the create dialog, discount codes as a product discount with codes |
| [`api/create-quantity-draft.md`](api/create-quantity-draft.md) | `POST /offers`: a quantity draft on the 4,900 product, 201 |
| [`api/publish-invalid.md`](api/publish-invalid.md) | `POST /offers/:id/publish` of a draft with no product: 422 `offers.publish-invalid` with its problems |
| [`api/publish.md`](api/publish.md) | `POST /offers/:id/publish` and `publishOffer`: status `active`, `publishedAt` set |
| [`api/list-by-status-and-kind.md`](api/list-by-status-and-kind.md) | `GET /offers?status=active&kind=quantity` and `offers(options:)` |
| [`api/list-by-product.md`](api/list-by-product.md) | `GET /offers?productId=`: the offers on the 4,900 product |
| [`api/get-with-code-count.md`](api/get-with-code-count.md) | `GET /offers/:id` and `offer(id:)` of the codes offer: `codeCount` |
| [`api/update-version-conflict.md`](api/update-version-conflict.md) | `PATCH /offers/:id` at the current version (200), then at the old one: 409 `offers.offer-conflict` |
| [`api/pause-resume-archive.md`](api/pause-resume-archive.md) | `POST /offers/:id/pause`, `/resume`, `/archive` |
| [`api/edit-archived-refused.md`](api/edit-archived-refused.md) | `PATCH` and `updateOffer` on an archived offer: refused |
| [`api/duplicate.md`](api/duplicate.md) | `POST /offers/:id/duplicate`: a new draft copy, 201 |
| [`api/delete-published-refused.md`](api/delete-published-refused.md) | `DELETE /offers/:id` of a published offer: 409 `offers.offer-not-deletable`; a draft deletes |
| [`api/codes-add-and-generate.md`](api/codes-add-and-generate.md) | `POST /offers/:id/codes` (lower case stored upper case), `/codes/generate`, `generateOfferCodes`, `GET /offers/:id/codes`, `DELETE /offers/:id/codes/:code` |
| [`api/codes-same-in-two-businesses.md`](api/codes-same-in-two-businesses.md) | `SAME10` added in business A and in business B; each lists only its own row |
| [`api/stats-zero.md`](api/stats-zero.md) | `GET /offers/:id/stats` and `offerStats` before any order: zeros |
| [`api/preview-quantity.md`](api/preview-quantity.md) | `POST /offers/preview` and `previewOffer`: 1 piece 5,700 with a nudge of 980, 2 pieces 9,620, 3 pieces 12,495 (delivery free) |
| [`api/preview-bxgy.md`](api/preview-bxgy.md) | buy 2 get 1: a gift line at 0, total 9,800 + 800 |
| [`api/preview-addon.md`](api/preview-addon.md) | an add-on at 1,200 accepted: 4,900 + 1,200 + 800 |
| [`api/preview-warning-total-mode.md`](api/preview-warning-total-mode.md) | a total-price tier of 10,000 for 3 pieces: warning `tier_total_not_divisible` |
| [`api/isolation-b-offer-from-a.md`](api/isolation-b-offer-from-a.md) | A's owner on B's offer: `GET`/`PATCH`/`/codes` 404, `offer(id:)` null |
| [`api/forbidden-without-offers-view.md`](api/forbidden-without-offers-view.md) | a member without `offers.view`: `GET /offers` 403, `offers` FORBIDDEN |

Offer, code, business and store ids and channel tokens are placeholders (`<OFFER_QUANTITY>`, …); every assertion ran on
the real values. Product and variant ids are the engine's small integers.

## Screenshots

`screens/<screen>-<lang>-<viewport>.png`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: `offers-list`, `create-dialog` (All types, seven cards), one editor per kind
(`editor-quantity` of the saved three-tier offer with a preselected tier and free delivery on the top tier,
`editor-free_delivery`, `editor-product_discount`, `editor-discount_codes`, `editor-bxgy` of the saved buy 2 get 1,
`editor-order_discount`, `editor-addon` of the saved add-on), `arabic-preview` (the quantity editor's order-form preview
and summary), `codes-panel` (the codes offer with its codes) and `product-offers-block` (the 4,900 product's Offers
block). 48 files.

## Browser assertions in `scripts/evidence/P2.S5-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the display language, there is no horizontal overflow and nothing sticks out of a card.
- Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.
- The offers list shows at least 7 offers of the store.
- The create dialog, on All types, shows exactly seven app-type cards.
- Each of the seven editors shows its form, the Arabic order-form preview and the summary.
- The quantity editor's preview shows the first tier's unit price (4410 DZD).
- The codes panel lists WELCOME10 and SAME10.
- The product editor's Offers block lists the 3 offers bought on the 4,900 product.

## What was seen (§3a.17)

Every PNG was opened and read by eye (2026-11-21): all 48 of the run after the preview fix, then, on the final run
(image `46b91c5`, which differs only by the English summary sentence), the English shots that carry that sentence and
the codes panel (its generated codes change every run). For all 48: the only product names in the chrome are
our own ("CodShop Assistant", "Credits"); the framework's name appears nowhere (the account menu, which holds the
licence notice, is closed in every shot); no raw message id or English string shows on an Arabic page; Arabic pages
mirror (sidebar on the right, labels at the right edge, Publish / Save as draft at the inline end); no page scrolls
sideways and nothing sticks out of a card. The "Verify your email" card and the trial strip are the shell's, expected
for the seeded owner. Offer and product titles are Arabic in both display languages: the evidence writes them in
Arabic for the Arabic demo store. Every PNG is under 300 KB (largest: `editor-quantity-en-desktop`, 261 KiB).

| Screen | ar desktop / mobile, en desktop / mobile |
| --- | --- |
| `offers-list` | Seven offers of store A1: status tabs (All, Drafts, Active, Paused, Archived), seven kind chips, columns Offer, Type, Activation, Status, Dates, Orders, Delivered revenue, Discount given and a row menu; the codes offer reads "Discount codes, Codes: 6"; badges Draft / Archived / Active (green); zero performance shown as 0 and 0 DZD. On a phone the table keeps Offer, Status and the row menu, and the chips wrap. |
| `create-dialog` | "Create an offer" on All types: seven cards, Quantity offer first with the green "Recommended" badge, each with its one-line description. On a phone the dialog scrolls inside the viewport with the cards in one column. |
| `editor-quantity` | The saved three-tier offer: tier price mode, Tier 1 (2 pieces, 10 %, picked first) and Tier 2 (3 pieces, 15 %, free delivery) with the quick-percent chips, the chosen product, then the shared cards (How buyers get it, Who gets it, Shown on, Dates and limits with the Algeria-time hint, Combines with). Side column: Summary and the Arabic order-form preview. On a phone the side cards follow the form and the action bar sits at the bottom. |
| `editor-free_delivery`, `editor-product_discount`, `editor-discount_codes`, `editor-order_discount` | New-offer editors of each kind with its own settings (free delivery: when, delivery method, wilayas and who pays; product discount: applies to, percent or amount, most off a piece, countdown; discount codes adds the Codes card "Save the draft to add codes."; order discount: minimum none / amount / pieces). Previews priced by the server (4,410 + 800 = 5,210 saving 490; free delivery 4,900 with the "free delivery" badge). |
| `editor-bxgy` | The saved buy 2 get 1: buy / get pieces, most times per order, the buyer gets more of the same items, gifted piece free; the preview shows the gift line tagged "هدية" at 0 DZD, saving 4,900, total 10,600. |
| `editor-addon` | The saved add-on: fixed price 1,200, 3 pieces per order, offered on the thank-you page; the preview tags the add-on line "منتج إضافي" at 1,200, total 6,900. |
| `arabic-preview` | The quantity editor's Summary and order-form preview cards: 1 piece 5,700 with the nudge "أضف 1 للحصول على سعر أفضل", 2 pieces 9,620 saving 980, 3 pieces 12,495 with free delivery saving 3,005; the list price struck through. Right to left in both display languages. |
| `codes-panel` | WELCOME10 "Used 0 of 50", two EV… and two GQ… generated codes (the GQ ones limited to 1), SAME10, each with Remove; Add code (code, uses per code, "Codes are saved in capitals.") and Generate codes (how many, prefix, uses per code). On a phone the fields stack. |
| `product-offers-block` | The 4,900 product's Offers block: buy 2 get 1 (Draft), the duplicate quantity draft and the active quantity offer, each with its kind, and "Add a quantity offer". |

Fixed this session after looking:

- The order-form preview's lines did not wrap, so on desktop the side card clipped 62 px of prices and totals
  (`fix(offers): keep the order form preview inside its side card`); the script now fails a shot where anything
  sticks out of a card, and a browser test measures the preview.
- The English summary read "Sample: 1 pieces cost …" (`fix(offers): word the summary sample for any quantity`); it
  now reads "Sample: a quantity of 1 costs 6,900 DZD, saving 3,700 DZD."

Seen and left as is (follow-ups for the P2.S5 handoff):

- A saved variant target shows the fallback "Variant 18" ("الصنف 18") until it is picked again in the same visit: the
  offer view carries no target titles, and the catalog API resolves products, not variants, by id. It is the
  translated fallback by design; naming it needs target titles on the offer view.
- The preview prices every line at the sample price, so the add-on line shows 4,900 struck through and "saving 3,700"
  rather than the add-on product's own 1,500 (D2516's synthetic carts).
- On the codes panel (desktop) the Generate row's "Uses per code" field sits a few pixels above its neighbours because
  its hint is below it; cosmetic.
- In an English dashboard the Arabic offer titles are left-aligned (user text has no `dir="auto"`), as noted in P2.S1.
