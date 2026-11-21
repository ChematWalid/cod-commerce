# Evidence for P2.S3 (collections with conditions)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P2.S3.sh`. Data is synthetic
(the demo seed plus the tags, brand, products and collections the script creates). Image built from a tree with no
uncommitted change outside the evidence folders and browser tests, last image-relevant commit `1bea1ee577672baabe535a5234d228b46ec0ee8a`. Compose
project `cod-evidence`. Every transcript shows the GraphQL and the REST form of the operations it covers (D2314, D2315).

## API transcripts

| File | Shows |
| --- | --- |
| [`api/collections.md`](api/collections.md) | `createStoreCollection` (an Arabic title gives an Arabic slug), `storeCollections`, `storeCollection`, `updateStoreCollection`, `deleteStoreCollection`, `storeCollectionSlugAvailability` (taken, own slug, business B's slug free, the same slug free in B), a taken slug refused, and the `/catalog/collections` REST mirror of each |
| [`api/manual.md`](api/manual.md) | `setStoreCollectionProducts` and `storeCollectionProducts` in hand order, a reorder over `PUT /:id/products`, `GET /:id/products`; refused on an automatic collection and with business B's product |
| [`api/product-collections.md`](api/product-collections.md) | `storeProductCollections` (manual and automatic), `setStoreProductCollections`, `GET`/`PUT /of-product/:productId`, catalog's `catalogCollectionOptions` |
| [`api/rules.md`](api/rules.md) | AC1 All against Any (Tag, Price, Color), AC2 "Tag is not", AC3 an option value carried only by a hidden variant, an invalid rule refused |
| [`api/preview.md`](api/preview.md) | `previewStoreCollectionMatches` and `POST /preview`: count, paging, nothing saved, the per-minute budget (429 with `Retry-After`) |
| [`api/product-search.md`](api/product-search.md) | `storeCollectionProductSearch` and `GET /product-search`: the active store's products only |
| [`api/recompute.md`](api/recompute.md) | A tag added to a product makes it a member; a price raised out of range removes it (reads before and after, polled while the worker catches up) |
| [`api/options.md`](api/options.md) | `storeCollectionRuleOptions` and `GET /rule-options` of business A against business B |
| [`api/isolation.md`](api/isolation.md) | Business A on B's collection: null, 404, writes refused as not found; A's session on B's channel FORBIDDEN; stock `collections` FORBIDDEN to a merchant; the default channel lists none of the store collections |

Store, tag and brand ids and channel tokens are placeholders; every assertion ran on the real values. Collection, product,
variant and asset ids are the engine's small integers.

## Screenshots

`screens/<screen>-<lang>-<viewport>.png`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: `collections-list`, `collections-empty` (the owner's second store, which holds none),
`collection-new-manual` (three products picked through Add products, in hand order, not saved),
`collection-edit-automatic` (All, Tag + Price + Color rows, preview count), `collection-preview-any` (the same rule
switched to Any, larger count, not saved), `collection-delete-dialog`, `product-editor-collections` (the collections
block of the product editor: manual and added by rule) and `product-list-collection-filter` (catalog's list filtered by a
collection). 32 files.

## Browser assertions in `scripts/evidence/P2.S3-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the display language and there is no horizontal overflow.
- Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.
- The collections list shows the manual collection and Create; its delete dialog names the collection.
- A new collection gets the three products picked through Add products, listed in the order picked.
- The automatic collection shows its 3 condition rows and a preview count of 1 (All), the API's count.
- Switched to Any without saving, the preview counts 5, the API's count for Any.
- The product editor's collections block lists the manual collection of the product.
- The same block lists the automatic collection أحذية ترويجية حمراء the product matches by rule.
- Catalog's product list filtered by the manual collection shows exactly its 3 products.
- The owner's second store shows the empty collections list and no row.

## What was seen (§3a.17)

Every PNG of the final run was opened and read by eye (2026-11-21). For all 32: the only product names in the chrome are
our own ("CodShop Assistant", the "Credits" placeholder of the shell); the framework's name appears nowhere (the account
menu, which holds the licence notice, is closed in every shot); no raw message id or English string shows on an Arabic
page; Arabic pages mirror (sidebar on the right, titles, labels and checkboxes at the right edge, Save and Create at the
inline end, the visibility switch's knob at the inline end when on); no page scrolls sideways. The "Verify your email"
card and the trial strip are the shell's, expected for the seeded owner. Collection and product titles, tag and option
names are Arabic in both display languages: the demo store's language is Arabic (D2112).

Compared with "Collections" in `docs/research/second-pass.md:142-143`, the editor has every part listed there: image
(Choose from library, Upload image, Remove image), title, description (rich text), the Manual / Automatic switch with
"Products must match All conditions / Any condition", condition fields Tag, Brand, Price, On sale, Title plus each option
name of the store (اللون here), the operators "is any of" / "is not" (and "is between" for price), the live preview
("Matching products: N" with the first rows), manual Add products, Visibility ("Show in the store") and Organisation
(position). The link name (slug) field is ours (D2103 pattern).

| Screen | ar desktop / mobile, en desktop / mobile |
| --- | --- |
| `collections-list` | Nine collections of the Arabic demo store in position order: the manual تخفيضات الصيف (image, 3 products, position 0) first, then the automatic ones with their member counts; بدون ترويج and بلا أحمر (اللون is not [أحمر], 7 products) show the Hidden badge. On a phone the table keeps Collection, Visibility and the row menu. |
| `collections-empty` | The owner's second store (Demo Store 2 in the switcher): the empty-state sentence "No collections yet…", the search and Create collection. |
| `collection-new-manual` | "New collection" titled مختارات الجري / Running picks, Manual selected, the three products picked through Add products in the order picked (حذاء جري أحمر, حذاء جري أزرق, حقيبة جري) with drag handles, prices and Remove; slug empty with its "made from the title" hint; visibility on, position 0. On a phone the cards stack, Products before Image. |
| `collection-edit-automatic` | أحذية ترويجية حمراء: image, Automatic, All conditions selected, three rows Tag is any of [ترويج الأدلة], Price is between 2000 and 5000 (DZD fields), اللون is any of [أحمر] (in Arabic the operator reads أيٌّ من); preview "Matching products: 1" listing حذاء جري أحمر at 2,500, the API's count. On a phone each row stacks field, operator and Remove. |
| `collection-preview-any` | The same rule switched to Any condition without saving: preview "Matching products: 5" (p1-p4 and a seed shirt in the price range); p5, whose only red variant is hidden, is absent. |
| `collection-delete-dialog` | "Delete this collection?" naming تخفيضات الصيف, saying its products stay in the store, Cancel and Delete (destructive tint); the Arabic name sits isolated inside the English sentence. On a phone the buttons stack. |
| `product-editor-collections` | Catalog's product editor of حذاء جري أحمر with our Collections card in the side column: "Chosen by hand" with تخفيضات الصيف ticked and Save collections, "Added by rule" listing the three automatic collections it matches. On a phone the card follows Status and organisation. |
| `product-list-collection-filter` | Catalog's product list with the collection filter set to تخفيضات الصيف: exactly its three products. On a phone the filters stack. |

Fixed after the first look: the Arabic operator "is any of" read أحد, which on its own means "one" or "Sunday"; it now
reads أيٌّ من, so a row reads اللون أيٌّ من [أحمر]. The collections wording itself stays in the native review (D2326).
