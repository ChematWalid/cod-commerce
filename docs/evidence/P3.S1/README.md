# Evidence for P3.S1 (wilaya and commune data, delivery pricing)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P3.S1.sh`. Data is
synthetic: the demo seed's two businesses, the 69 wilayas and 1,541 communes the `migrate` role converges (D3123), each
store's seeded "Platform default prices" table (D3112), and what the script creates in store A1 (`demo`, Arabic): a
pricing option created at 650 DZD home everywhere, then edited back to each wilaya's base price with Alger overridden to 750, Alger-Centre to 777 and the Casbah without home
delivery, linked as the store default, a spare option (deleted) and one product at 4,900 DZD. Image built from a tree
with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit `934a7d7d625b48b32be4a7035e842bbfa7f89a46`.
Compose project `cod-evidence`.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/provinces-list.md`](api/provinces-list.md) | `GET /provinces`: 69 wilayas, public and cacheable (D3117) |
| [`api/province-by-code.md`](api/province-by-code.md) | `GET /provinces/code/16` with its communes (cut to three), `/code/1` answering `01`, `/code/70` 404 (D3115) |
| [`api/fee-group-create.md`](api/fee-group-create.md) | `POST /delivery-fees` (201) and `createDeliveryFeeGroup` |
| [`api/fee-group-list.md`](api/fee-group-list.md) | `GET /delivery-fees` with the platform table, `deliveryFeeGroups` with a search |
| [`api/fee-group-update.md`](api/fee-group-update.md) | `PUT /delivery-fees/:id` and `updateDeliveryFeeGroup`: Alger at 750 stored as an override (D3107) |
| [`api/fee-group-communes.md`](api/fee-group-communes.md) | `PUT /delivery-fees/:id/communes/16` and `setDeliveryFeeCommuneRates`: Alger-Centre 777, the Casbah off |
| [`api/fee-group-read.md`](api/fee-group-read.md) | `GET /delivery-fees/:id` and `deliveryFeeGroup(id)` with the commune overrides |
| [`api/update-store-default-fee-group.md`](api/update-store-default-fee-group.md) | `updateStore` linking the store's own option as its default (#207) |
| [`api/fee-group-delete.md`](api/fee-group-delete.md) | `DELETE /delivery-fees/:id`: the platform table and the store default 409 `group-in-use` (D3108), a spare 200, `deleteDeliveryFeeGroup` of it again not found |
| [`api/store-provinces-narrowed.md`](api/store-provinces-narrowed.md) | signed `GET /store/provinces/code/16?storeId=`: the Casbah without home delivery; B's store id under A's signed store header 404 (D3135); unsigned 404 (D112) |
| [`api/isolation-b-group-from-a.md`](api/isolation-b-group-from-a.md) | A's owner on B's option: `GET`/`PUT`/`communes` 404, `deliveryFeeGroup` null, B's option unchanged |
| [`api/update-store-refused-references.md`](api/update-store-refused-references.md) | `updateStore` with B's option (#230) or any carrier id (#153): `tenancy.store-reference-not-found`, the default kept |
| [`api/shipping-quote-commune.md`](api/shipping-quote-commune.md) | in process: `ShippingQuoteService.quote` to Alger-Centre, 777 with `source: 'commune'` |
| [`api/offers-quote-delivery.md`](api/offers-quote-delivery.md) | in process: `PricingService.quoteForScope` carrying the fee through the offers' shipping seam, 4,900 + 777 |

Fee-group, business and store ids are placeholders (`<GROUP_EVIDENCE>`, …), and a `quoteToken` keeps only its
`qt1` prefix (its payload encodes the real ids); every assertion ran on the real values.
Wilaya rows are cut to three of 69 and communes to a few in the transcripts (`ratesShown`, `townsShown`).

## Screenshots

`screens/<screen>-<lang>-<viewport>.png`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: `pricing-list` (Delivery → Delivery pricing), `new-pricing-top` and
`new-pricing-table` (the New pricing option form's settings and its wilaya table), `edit-override` (the saved option
with Alger's Edited mark), `edit-communes` (Alger expanded to its communes) and `store-settings-fee-group` (the store
card's Default pricing option). 24 files.

- [`screens/edit-communes-ar-desktop.png`](screens/edit-communes-ar-desktop.png)
- [`screens/edit-communes-ar-mobile.png`](screens/edit-communes-ar-mobile.png)
- [`screens/edit-communes-en-desktop.png`](screens/edit-communes-en-desktop.png)
- [`screens/edit-communes-en-mobile.png`](screens/edit-communes-en-mobile.png)
- [`screens/edit-override-ar-desktop.png`](screens/edit-override-ar-desktop.png)
- [`screens/edit-override-ar-mobile.png`](screens/edit-override-ar-mobile.png)
- [`screens/edit-override-en-desktop.png`](screens/edit-override-en-desktop.png)
- [`screens/edit-override-en-mobile.png`](screens/edit-override-en-mobile.png)
- [`screens/new-pricing-table-ar-desktop.png`](screens/new-pricing-table-ar-desktop.png)
- [`screens/new-pricing-table-ar-mobile.png`](screens/new-pricing-table-ar-mobile.png)
- [`screens/new-pricing-table-en-desktop.png`](screens/new-pricing-table-en-desktop.png)
- [`screens/new-pricing-table-en-mobile.png`](screens/new-pricing-table-en-mobile.png)
- [`screens/new-pricing-top-ar-desktop.png`](screens/new-pricing-top-ar-desktop.png)
- [`screens/new-pricing-top-ar-mobile.png`](screens/new-pricing-top-ar-mobile.png)
- [`screens/new-pricing-top-en-desktop.png`](screens/new-pricing-top-en-desktop.png)
- [`screens/new-pricing-top-en-mobile.png`](screens/new-pricing-top-en-mobile.png)
- [`screens/pricing-list-ar-desktop.png`](screens/pricing-list-ar-desktop.png)
- [`screens/pricing-list-ar-mobile.png`](screens/pricing-list-ar-mobile.png)
- [`screens/pricing-list-en-desktop.png`](screens/pricing-list-en-desktop.png)
- [`screens/pricing-list-en-mobile.png`](screens/pricing-list-en-mobile.png)
- [`screens/store-settings-fee-group-ar-desktop.png`](screens/store-settings-fee-group-ar-desktop.png)
- [`screens/store-settings-fee-group-ar-mobile.png`](screens/store-settings-fee-group-ar-mobile.png)
- [`screens/store-settings-fee-group-en-desktop.png`](screens/store-settings-fee-group-en-desktop.png)
- [`screens/store-settings-fee-group-en-mobile.png`](screens/store-settings-fee-group-en-mobile.png)

## Browser assertions in `scripts/evidence/P3.S1-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the display language, there is no horizontal overflow and nothing sticks out of a card.
- Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.
- The Delivery pricing tab lists at least 2 pricing options, the evidence option among them.
- The new pricing option form lists all 69 wilayas.
- The saved option's Alger row shows the Edited mark of its override.
- Alger's Communes button opens its commune panel with its communes listed.
- The store settings card's Default pricing option field names the evidence option.

## Seen by eye (2026-11-23, all 24 PNGs opened)

- **Branding:** no third-party product name on any shot; the header shows our own "CodShop Assistant" and "Credits".
- **RTL:** every Arabic shot has the sidebar on the right, right-aligned labels and titles, and the wilaya codes before
  their names (`16 الجزائر`). Switches mirror: on is a dark track with the knob on the left. Every English shot is
  left to right.
- **Translations:** no raw message id and no English UI string on an Arabic shot. Data is shown as stored: the seeded
  "Platform default prices" option keeps its English name in Arabic, and so does the store name "Demo Store". Wilaya
  and commune names follow the display language (Adrar / أدرار, Alger Centre / الجزائر الوسطى).
- **pricing-list:** the tab shows two options, the evidence option and "Platform default prices" with its Platform
  default badge. Desktop shows Delivery agent and Created; mobile shows the option name and the row menu only.
- **new-pricing-top / new-pricing-table:** the form's settings card (name, carrier "No carrier", overweight switch) and
  its Apply to all card. The table lists the wilayas with the platform base prices (Adrar 1100/600, Chlef 690/400), both
  switches on and a Communes button per row. On mobile each row stacks into labelled fields. At 390 px the action bar
  shows Save only: the Back to pricing button that desktop shows is not visible (noted, not a layout break).
- **edit-override:** Alger at 750/400 with the Edited badge and Reset to default. Its neighbours are at their base
  prices, without a badge.
- **edit-communes:** Alger's panel opens under its row with the hint about blank prices. Alger-Centre shows 777 with
  Edited. The Casbah shows Edited with its home delivery switch off. Other communes show the wilaya's 750/400 as
  placeholders, and their stop-desk switch is greyed where the commune has no stop desk. In Arabic, the commune
  placeholders sit at the right of their inputs while typed values (777) sit at the left. This is cosmetic and was
  noted, not fixed.
- **store-settings-fee-group:** the store card's Default pricing option names "خيار التسعير للأدلة", with its help text.
  Save is disabled because nothing changed.
- **Layout:** no horizontal overflow, clipped text or overlapping controls at either width. Every PNG is under 100 KB.
