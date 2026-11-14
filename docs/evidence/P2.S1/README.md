# Evidence for P2.S1 (products and variants)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P2.S1.sh`. Data is synthetic
(the demo seed's five products per demo store, plus what the script creates). Image built from a tree with no uncommitted
change outside the evidence folders and browser tests, last image-relevant commit `36fed83de15fc5d99d0456a0f9e67c9032f1b920`. Compose project
`cod-evidence`.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/products.md`](api/products.md) | `catalogProducts` (tabs, search by name, variant SKU and barcode, brand and tag filters), `catalogProduct`, `createCatalogProduct` with a Color × Size matrix, `updateCatalogProduct` of one variant, `setCatalogProductStatus`, `deleteCatalogProduct`, and the REST mirror of each |
| [`api/slug-availability.md`](api/slug-availability.md) | `catalogSlugAvailability` and `GET /catalog/products/slug-availability`: an Arabic slug taken in its store, free in the other business's store, another business's slug free (no oracle) |
| [`api/taxonomy.md`](api/taxonomy.md) | Brands, tags and highlights: list, create, rename, delete over GraphQL and REST; a seventh highlight on a product refused |
| [`api/media.md`](api/media.md) | `uploadCatalogMedia` (a PNG; an SVG and a 5 242 881-byte JPEG refused), `catalogMedia`, `deleteCatalogMedia` (refused while a product uses it), `GET`/`DELETE /catalog/media` |
| [`api/sold-out.md`](api/sold-out.md) | `catalogSoldOutProducts`, `stopCatalogSoldOutOrders`, `resumeCatalogSoldOutOrders` and `/catalog/sold-out-products` |
| [`api/logo-url.md`](api/logo-url.md) | `uploadBusinessLogo`, `updateBusiness`/`updateStore` with the logo, then `logoUrl` on `activeBusiness` and `store`; the other business sees no logo |
| [`api/isolation.md`](api/isolation.md) | Business A on B's product: `catalogProduct` null, REST 404, writes refused as not found; A's session on B's channel FORBIDDEN |

Store, business, brand, tag, highlight and media ids and channel tokens are placeholders; every assertion ran on the real
values. Product, variant and asset ids are the engine's small integers.

## Screenshots

`screens/<screen>-<lang>-<viewport>.png`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: `product-list`, `product-list-draft`, `product-list-sold-out` (Stop orders / Resume
orders), `product-new`, `product-edit-variants` (Color × Size, four variants), `product-edit-settings` (Hidden selected,
"Mark as sold out" on), `media-picker`, `media-upload-refused` (the toast after an SVG upload), `settings-profile`
(business and store logo, show-address, sold-out Keep/Hide) and `create-store-timeout` (the create-store dialog after its
wait ran out, reached by answering `createStore` with a channel the session never lists: a network stub, nothing is
created). 40 files.

## Browser assertions in `scripts/evidence/P2.S1-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the display language and there is no horizontal overflow.
- Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.
- The product list shows the seeded products and Create product; the Draft tab shows drafts only.
- The sold-out tab shows Stop orders / Resume orders and exactly one product, marked sold out.
- The editor of the Color x Size product shows four variant rows.
- The editor of the hidden product has Hidden selected and "Mark as sold out" on.
- The media picker lists library images; an SVG upload shows the media-type refusal.
- General settings shows the business and store logos as loaded images, the address switch and Keep/Hide.
- After the wait for a new store runs out, the dialog offers Check again and no second Create.

## What was seen (§3a.17)

Every PNG of the final run was opened and read by eye (2026-11-14). For all 40: the only product names in the chrome are
our own ("CodShop Assistant", "Credits" placeholders of the shell); the framework's name appears nowhere (the account
menu, which holds the licence notice, is closed in every shot); no raw message id or English string shows on an Arabic
page; Arabic pages mirror (sidebar on the right, titles and labels at the right edge, primary buttons at the inline
end); no page scrolls sideways. The "Verify your email" card and the trial strip are the shell's, expected for the
seeded owner. Product titles are Arabic in both display languages: the demo store's language is Arabic (D2112).

Compared with "Products" in `docs/research/dashboard-captures.md` and `second-pass.md`: the list has the All / Draft
tabs (plus our Sold out tab, AC6), search by name / SKU / barcode, Collection, Brand and Tag filters, and the columns
Product, Status, Price, Collections, Created, row actions. Import, Export and the tutorial are not part of P2.S1.

| Screen | ar desktop / mobile, en desktop / mobile |
| --- | --- |
| `product-list` | Seven products of the Arabic demo store (the seed's five, the evidence matrix product with its red featured image, the Arabic-titled shoe); status badges Active / Hidden / Draft, the hidden cap also carries "Sold out"; prices with DZD (د.ج), creation dates localised. Create product sits in the title row (fixed this session). On a phone the table keeps Product, Status and the row menu. |
| `product-list-draft` | Draft tab selected; one row, the draft mug. |
| `product-list-sold-out` | Sold out tab: the hint "For every sold-out product of this store:" with Stop orders and Resume orders, one row (the hidden cap, Hidden + Sold out). On a phone the two buttons wrap under the hint. |
| `product-new` | Empty editor "New product": Details (name, slug, rich-text description, label, card caption), Images (Choose from library, Upload image), Pricing (DZD suffix), Options, then the side cards Status and organisation (Active preselected, No brand, collections hint, tags), Highlights 0 / 6, Settings (switches, grams and cm, order managers from the team), Search engines. On a phone the cards stack in one column. |
| `product-edit-variants` | The Color × Size product: two images (red featured), price 2500 / old price 3200, options اللون (أحمر, أزرق) and المقاس (S, M), and the Variants table with four rows EVTEE-1…4, the second at 3100 and the first hidden. On a phone the SKU and price fields keep their width and the table scrolls inside its card (fixed this session: values were cut to "EV1", "250"). |
| `media-picker` | The Media library dialog over the editor with the two library images (the other two were deleted by the API transcript), Use selected images and Cancel; buttons stack on a phone. |
| `media-upload-refused` | After an SVG upload: the toast "Only PNG, JPEG, GIF and WebP images can be uploaded." (Arabic: "يمكن رفع صور PNG وJPEG وGIF وWebP فقط."); the library and the product are unchanged. |
| `product-edit-settings` | The seed's hidden cap: Hidden selected, "Mark as sold out" and "Accept orders while sold out" on (orders resumed by the API transcript). In Arabic the on switches have their thumb at the inline end. |
| `settings-profile` | General settings: business logo and store logo (the uploaded teal PNG) with Upload logo, names, store language, "Show the address field" on, Sold-out products Keep (selected) / Hide. In Arabic the show-address switch now has its thumb at the inline end (fixed this session: it sat where "off" sits). |
| `create-store-timeout` | The Create store dialog after its 10 s wait: the red line "Your store was created, but it could not be opened yet. Check again in a moment.", Check again instead of Create, Cancel. The close button does not cover the title in either direction. |

Seen and left as is (recorded in the P2.S1 handoff as issues):

- In an English dashboard, Arabic option values and highlights that end with a digit render with the digit first
  ("3 ميزة إضافية", "أحمر / S"): user text has no `dir="auto"`. Readable, the stored text is right; a later polish.
- On a phone the product list hides Price, Collections and Created; the editor is the place to read them.
