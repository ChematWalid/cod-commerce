# Evidence for P3.S2 (storefront skeleton)

Transcripts, timings and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P3.S2.sh`
(with `P3.S2-api.sh`, `P3.S2-cache.sh` and `P3.S2-screens.mjs`); nothing here is hand-written except the "What was seen"
notes. Data is synthetic: the demo seed's businesses and stores (`demo.localhost` Arabic, `second.localhost` French, each with the
seed's products and two collections), plus what the script writes over the catalog Admin API: three English products with
images and a manual collection in `demo2.localhost` (`Demo Store 2`, English, empty after the seed) and one Arabic product
(`سروال قطني للأدلة`) in `demo.localhost` for the Latin-script Darija search.

- Image `cod-platform:local` (tagged `cod-platform:evidence-0822892c`), from a tree with no uncommitted change outside docs and the evidence
  folders, last image-relevant commit `0822892cdcb6c66b8d85bd180bc6276fdb68913c`; the running storefront's `NEXT_DEPLOYMENT_ID` is `0822892c`.
- Compose project `cod-evidence`: api, worker, storefront (instance A, host port 23001), plus a second
  instance B of the same storefront service on 23002 and a compact-theme instance on
  23003 (its own Valkey database, so its pages never share entries with the default theme's).
- Images are served by the api's asset server (`STOREFRONT_ASSET_BASE=http://127.0.0.1:23100/assets`).

## API transcripts

Store, business and channel ids and host bindings are placeholders (`<STORE_DEMO>`, …); every assertion ran on the real
values. Signed calls show the signature headers redacted. HTML bodies are cut by the script to the element that identifies
the page; the checks ran on the whole body.

| File | Shows |
| --- | --- |
| [`api/store-resolve.md`](api/store-resolve.md) | `GET /store/resolve?host=` signed: the three stores with language, direction, primary host and settings; an unknown host 404; an unsigned call 404 |
| [`api/store-products.md`](api/store-products.md) | `GET /store/products` signed for the Arabic and the English store (each its own products only), `sort=price-asc`, unsigned 404 |
| [`api/store-product.md`](api/store-product.md) | `GET /store/product/:slug`: the Arabic store's product (options, variants, images); the same slug signed for the French store 404; a draft's slug 404 |
| [`api/store-search.md`](api/store-search.md) | `GET /store/product/search`: Arabic without and with diacritics (same hits), Latin-script Darija `serwal` finding `سروال قطني للأدلة`; the Arabic word signed for the French store finds none of the Arabic store's products |
| [`api/store-collections.md`](api/store-collections.md) | `GET /store/collections` and `GET /store/collection/:slug` for the Arabic store; the same slug for the French store 404 |
| [`api/storefront-pages.md`](api/storefront-pages.md) | Tenant pages by `Host`: each store's home and products page 200 with `cloudflare-cdn-cache-control` and no `set-cookie`; unknown host 404; spoofed `X-Forwarded-Host` ignored |
| [`api/storefront-isolation.md`](api/storefront-isolation.md) | The French store's tenant path `/_t/fr/<STORE_SECOND>/<BINDING_SECOND>` (as written and `%5F`-encoded) on the Arabic host 404; the Arabic product's slug on the French host: the not-found page |
| [`api/storefront-store-api.md`](api/storefront-store-api.md) | `/api/store/products` on the Arabic host (its products, `private, no-store`), another store's `storeId` on the French host 400 empty, `/api/store/product/..%2F..%2Fshop-api` 404 empty |
| [`api/storefront-revalidate.md`](api/storefront-revalidate.md) | `POST /api/internal/revalidate` unsigned 404 empty, signed with a malformed body 400, signed 200 |
| [`api/two-instances.md`](api/two-instances.md) | Two `next start` instances on one Valkey: a page rendered on A is served by B from the shared cache; a signed revalidation on A refreshes B, with timings |

## Screenshots

`screens/<store>-<page>-<viewport>.png`: stores `ar` (`demo.localhost`, RTL), `fr` (`second.localhost`) and `en` (`demo2.localhost`);
pages `home`, `products`, `product` (a second option picked in the variant picker), `category`, `search`, `cart` (after
"add to cart"), `checkout`, `success` and `404`; desktop 1280 × 800 and mobile 390 × 844 (scale 2, touch). Plus
`compact-ar-home-*` and `compact-en-home-*`: the same build with `STOREFRONT_THEME=compact` and no code change. Viewport
shots, `reducedMotion: reduce`. 58 files, each at most 300 KB.

## Browser assertions in `scripts/evidence/P3.S2-screens.mjs`

- 404: /this-page-does-not-exist answers the not-found page (HTTP 404) with the message in the store's language
- cart: the line added on the product page is listed
- category: the collection's title
- checkout: the localized checkout title (the disabled shell of P3.S2)
- compact: the home page renders exactly the compact theme's sections (header, product-grid, footer) with STOREFRONT_THEME=compact on the same image
- every page: <html> lang/dir of the store (ar rtl, fr and en ltr), no other store's name, no raw message key or snowflake id, no third-party product or framework name, no sideways scroll, every image loaded
- home: the store name in the header is the store's own
- product: "add to cart" stores a line (variant id and quantity) in localStorage cod.cart.v1
- product: h1 is the product's name; the second option of the first group is pressed after a click and a price shows
- products: the localized "All products" heading and the store's own products
- search: a query in the store's language finds one of its products
- success: the localized thank-you title

## What was seen (§3a.17)

Every PNG of the run was opened and read by eye (2026-11-23). The checks below are the eye's; the script's own assertions
are listed above.

**Found and fixed while shooting (each re-shot):**

- The demo seed created no product with an image on a live stack: its store context had no user, so the media library
  reached no store and every image failed with `MediaNotFoundError` (`fix(server): seed demo products as the business
  owner …`).
- Every product page of the Arabic store answered the soft 404, though `/api/store/product/<slug>` answered 200: the
  storefront's slug check allowed only `a-z0-9-` while the catalog keeps Arabic letters in a slug, and Next hands the page
  a non-ASCII segment percent-encoded (`fix(storefront): accept the letters of any language …` and `fix(storefront):
  decode a product or collection route segment once …`).
- The compact theme's home on a desktop put each product's name beside its 300 px image, at the image's baseline, in its
  two wide columns (`fix(storefront): keep a product card's name under its image …`).

**For all 58 shots:** the only names on screen are the stores' own (`Demo Store`, `Second Store`, `Demo Store 2`) and the
synthetic products; no framework or third-party product name; no raw message key or id; no sideways scroll; every
image loaded. Arabic pages mirror: store name at the right, navigation (المنتجات، بحث، السلة) at the left, headings,
cards, prices, form labels and fields right-aligned, the first card at the right; prices read `2.900 د.ج`. French and
English pages are left to right with `3 800 DA` and `1,200 DA`.

| Screen | ar (demo.localhost) | fr (second.localhost) | en (demo2.localhost) |
| --- | --- | --- | --- |
| `home` | Announcement bar, header, hero "Demo Store" with تسوّق الآن, newest products (the Darija test product first). Mobile: two columns. | Same layout in French ("Découvrir"), eight seed products. | Three products the script created, the "Collections" list (Summer picks), trust badges, footer. |
| `products` | "كل المنتجات", the three sort links, ten products with old prices struck through. | "Tous les produits", Nouveautés / Prix croissant / Prix décroissant. | "All products", three products. |
| `product` | Name (وسادة مطرزة تجريبية), image, price 1.600 د.ج, "اختر اللون" with بيج pressed, quantity, add to cart; the checkout shell follows (mobile). | "Coussin brodé démo", "Choisir Couleur", Beige pressed. | "Linen shirt", Navy pressed: the price follows the variant (3,400 DA, old 3,900 DA); the image stays the product's first one, since the script gave the variants no image of their own. |
| `category` | "ملابس وإكسسوارات" and its four products. | "Vêtements et accessoires", four products. | "Summer picks", three products. |
| `search` | The query field with قميص and one hit (قميص قطني تجريبي). | "Coussin", one hit. | "shirt", one hit (Linen shirt). |
| `cart` | "سلتك", the added line as "الكمية: 1" with إزالة, إتمام الطلب, trust badges. | "Votre panier", "Quantité: 1", Retirer, Passer la commande. | "Your cart", "Quantity: 1", Remove, Checkout. |
| `checkout` | "إتمام الطلب", the cart line, disabled fields (name, phone, wilaya, commune, address), "الدفع عند الاستلام", تأكيد الطلب. | "Commande", same fields in French. | "Checkout", same fields in English. |
| `success` | "شكرًا لك، تم تسجيل طلبك", the call-back sentence, العودة إلى المتجر. | "Merci, votre commande est enregistrée". | "Thank you, your order is placed". |
| `404` | The not-found page: the message in Arabic, French and English, centred (by design it renders all three platform languages, `not-found-content.tsx`). | Same. | Same. |
| `compact-*-home` | Compact theme: no announcement or hero, the header then a two-column grid (larger radius, system font, light grey background); on a desktop each image fills its column (the 300 px preset upscaled, its edges slightly soft) with the name and price under it, on a phone the same as the default grid. | — | Same in English. |

**Noted, not changed (P3.S3 or later):** the cart and checkout lines show only "Quantity: 1" and Remove, no product name or
price (D3223 f: names and prices come with the order summary of P3.S3); the struck-through old price sits 8 px in from the
card's inline start in both directions (`margin-inline-start`); French "Quantité: 1" has no space before the colon; the
search page has no heading above its field.
