# shellcheck shell=bash
# The API part of scripts/evidence/P3.S2.sh, sourced by it after the sign-ins: writes the English store's catalog and the
# Darija-searchable Arabic product over the Admin API, waits for the projection, then records the api's signed /store/*
# endpoints and the storefront's routes. Uses the driver's helpers and variables (owner, demo, en, second, *_store, out,
# work, api, site); writes $work/stores.json for P3.S2-screens.mjs and sets demo_product_slug, demo_product_id for the cache check.

# --- synthetic images ------------------------------------------------------------------------------
# Solid-colour PNGs with a lighter centre square, so a product tile shows something without real photos.
make_png() { # make_png <file> <r> <g> <b>
  node -e '
const zlib = require("zlib"), fs = require("fs");
const [file, r, g, b] = process.argv.slice(1).map((v, i) => (i === 0 ? v : +v)); const size = 480;
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
const light = (v) => Math.min(255, v + 60);
const rows = [];
for (let y = 0; y < size; y++) {
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    const inner = x > size / 4 && x < (3 * size) / 4 && y > size / 4 && y < (3 * size) / 4;
    row.set(inner ? [light(r), light(g), light(b)] : [r, g, b], 1 + x * 3);
  }
  rows.push(row);
}
fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]));' "$1" "$2" "$3" "$4"
}
make_png "$work/sand.png" 194 160 110
make_png "$work/navy.png" 40 60 110
make_png "$work/olive.png" 110 120 60
make_png "$work/terracotta.png" 170 80 60
make_png "$work/indigo.png" 60 70 150

Q_UPLOAD='mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId } }'
Q_CREATE_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id slug title variants { id optionValues } } } }'
Q_UPDATE_PRODUCT='mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { product { id title } } }'
Q_CREATE_COLLECTION='mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id slug title } }'
Q_SET_MEMBERS='mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id productCount } }'
Q_PRODUCTS='query ($options: CatalogProductListInput) { catalogProducts(options: $options) { items { id title slug status } } }'

asset_of() { # asset_of <png> <session> <channel> -> asset id
  upload "$Q_UPLOAD" "$1" image/png "$(basename "$1")" "$2" "$3"; expect_ok "upload $1"
  js 'b.data.uploadCatalogMedia.assetId' "$work/b"
}
create_product() { # create_product <input-js> <session> <channel> -> $work/b
  gql "$Q_CREATE_PRODUCT" "$(vars "{input:$1}")" "$2" "$3"; expect_ok "create product $1"
}

# --- the English store's catalog (demo2 is empty after the seed) ----------------------------------
sand=$(asset_of "$work/sand.png" "$owner" "$en"); navy=$(asset_of "$work/navy.png" "$owner" "$en")
olive=$(asset_of "$work/olive.png" "$owner" "$en"); terracotta=$(asset_of "$work/terracotta.png" "$owner" "$en")
create_product "{title:'Linen shirt',slug:'linen-shirt',status:'active',price:3200,oldPrice:3900,sku:'EV-EN-SHIRT',assetIds:['$sand','$navy'],featuredAssetId:'$sand',optionGroups:[{name:'Color',values:['Sand','Navy']},{name:'Size',values:['S','M']}]}" "$owner" "$en"
shirt_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
navy_variants=$(js "b.data.createCatalogProduct.product.variants.filter((v)=>v.optionValues.includes('Navy')).map((v)=>({id:v.id,price:3400}))" "$work/b")
[[ "$navy_variants" == *id* ]] || fail "the shirt has no Navy variant: $(command cat "$work/b")"
gql "$Q_UPDATE_PRODUCT" "$(vars "{id:'$shirt_id',input:{variants:$navy_variants}}")" "$owner" "$en"; expect_ok "navy price"
create_product "{title:'Canvas tote bag',slug:'canvas-tote-bag',status:'active',price:1800,sku:'EV-EN-TOTE',assetIds:['$olive'],featuredAssetId:'$olive'}" "$owner" "$en"
tote_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
create_product "{title:'Ceramic mug',slug:'ceramic-mug',status:'active',price:1200,oldPrice:1500,sku:'EV-EN-MUG',assetIds:['$terracotta'],featuredAssetId:'$terracotta'}" "$owner" "$en"
mug_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
gql "$Q_CREATE_COLLECTION" "$(vars "{input:{title:'Summer picks',slug:'summer-picks',visible:true,position:1,mode:'manual'}}")" "$owner" "$en"
expect_ok "create collection"
picks_id=$(js 'b.data.createStoreCollection.id' "$work/b")
gql "$Q_SET_MEMBERS" "$(vars "{id:'$picks_id',productIds:['$shirt_id','$tote_id','$mug_id']}")" "$owner" "$en"; expect_ok "collection members"

# --- the Arabic store's Darija product (ADR 0014: "serwal" is a seeded synonym of سروال) ----------
export DARIJA_TITLE='سروال قطني للأدلة'
indigo=$(asset_of "$work/indigo.png" "$owner" "$demo")
create_product "{title:'$DARIJA_TITLE',status:'active',price:2900,sku:'EV-AR-SERWAL',assetIds:['$indigo'],featuredAssetId:'$indigo'}" "$owner" "$demo"
gql "$Q_PRODUCTS" '{"options":{"tab":"draft","take":10}}' "$owner" "$demo"; expect_ok "drafts"
draft_slug=$(js "b.data.catalogProducts.items.find((p)=>p.status==='draft').slug" "$work/b")
[[ -n "$draft_slug" && "$draft_slug" != undefined ]] || fail "the seed made no draft in the Arabic store"

# --- the projection, filled by the worker from the outbox (D3205) --------------------------------
wait_listed() { # wait_listed <store-id> <assertion over b.items> <label>
  local deadline=$((SECONDS + PROJECTION_WAIT_SECONDS))
  while :; do
    api_get '/store/products?take=50' "$1"
    [[ "$status" == 200 && "$(js "$2" "$work/b")" == true ]] && return 0
    ((SECONDS < deadline)) || fail "$3: the projection lists $(command head -c 600 "$work/b") after ${PROJECTION_WAIT_SECONDS}s"
    sleep 4
  done
}
wait_listed "$demo_store" "b.items.some((p)=>p.name==='$DARIJA_TITLE')&&b.items.length>=4" "Arabic store"
command cp "$work/b" "$work/demo-list.json"
wait_listed "$second_store" 'b.items.length>=3' "French store"
command cp "$work/b" "$work/second-list.json"
wait_listed "$en_store" 'b.items.length===3' "English store"
command cp "$work/b" "$work/en-list.json"

# A store's product with options, its first collection and the names it lists, for the screens.
store_facts() { # store_facts <key> <store-id> <host> <name> <locale> <list-json> <search-term|-> -> appends to $work/stores.ndjson
  local slug="" item
  for item in $(js 'b.items.map((p)=>encodeURIComponent(p.slug)).join(" ")' "$6"); do
    api_get "/store/product/$item" "$2"; expect_status "product $item of $1" 200
    if [[ "$(js 'b.optionGroups.length>0&&b.optionGroups[0].options.length>1' "$work/b")" == true ]]; then slug=$item; break; fi
  done
  [[ -n "$slug" ]] || fail "$1: no listed product with a two-option group"
  command cp "$work/b" "$work/$1-product.json"
  api_get /store/collections "$2"; expect_status "collections of $1" 200
  command cp "$work/b" "$work/$1-collections.json"
  K="$1" ID="$2" H="$3" N="$4" L="$5" T="$7" node -e '
const fs = require("fs");
const [listFile, productFile, collectionsFile] = process.argv.slice(1);
const list = JSON.parse(fs.readFileSync(listFile, "utf8"));
const product = JSON.parse(fs.readFileSync(productFile, "utf8"));
const collection = JSON.parse(fs.readFileSync(collectionsFile, "utf8")).items[0];
if (!collection) throw new Error(process.env.K + ": no visible collection");
const e = process.env;
fs.appendFileSync(process.argv[4], JSON.stringify({
  key: e.K, storeId: e.ID, host: e.H, name: e.N, locale: e.L, dir: e.L === "ar" ? "rtl" : "ltr",
  productSlug: product.slug, productName: product.name,
  secondOption: product.optionGroups[0].options[1].name,
  categorySlug: collection.slug, categoryTitle: collection.title,
  searchTerm: e.T === "-" ? product.name.split(" ")[0] : e.T,
  productNames: list.items.map((p) => p.name),
}) + "\n");' "$6" "$work/$1-product.json" "$work/$1-collections.json" "$work/stores.ndjson"
}
: >"$work/stores.ndjson"
store_facts ar "$demo_store" "$DEMO_HOST" "$DEMO_NAME" ar "$work/demo-list.json" 'قميص'
store_facts fr "$second_store" "$SECOND_HOST" "$SECOND_NAME" fr "$work/second-list.json" -
store_facts en "$en_store" "$EN_HOST" "$EN_NAME" en "$work/en-list.json" shirt
node -e 'const fs=require("fs"); fs.writeFileSync(process.argv[2], JSON.stringify(fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse), null, 2))' \
  "$work/stores.ndjson" "$work/stores.json"
export EV_STORES_JSON=$work/stores.json
# Slugs go into URLs (and signatures) encoded, as the storefront sends them.
demo_product_slug=$(urlencode "$(js 'b[0].productSlug' "$work/stores.json")")
demo_product_name=$(js 'b[0].productName' "$work/stores.json")
demo_category_raw=$(js 'b[0].categorySlug' "$work/stores.json")
demo_product_id=$(js 'b.id' "$work/ar-product.json")
second_names=$(js 'b[1].productNames.join("\n")' "$work/stores.json")
demo_names=$(js 'b[0].productNames.join("\n")' "$work/stores.json")

# --- store-resolve.md -----------------------------------------------------------------------------
f="$out/api/store-resolve.md"
begin "$f" "GET /store/resolve" "The storefront asks the api which store a host belongs to (signed, ADR 0008). The answer is the public store shape (D3203): name, language and direction, primary host, address-field and sold-out settings. An unknown host and an unsigned call answer an empty 404."
for host in "$DEMO_HOST" "$SECOND_HOST" "$EN_HOST"; do
  api_get "/store/resolve?host=$host" -; expect_status "resolve $host" 200
  assert_js "resolve $host" "b.primaryHost==='$host'&&b.status==='active'&&b.direction===(b.language==='ar'?'rtl':'ltr')" "$work/b"
  emit_api "$f" "Signed, host $host" "/store/resolve?host=$host"
done
api_get "/store/resolve?host=$UNKNOWN_HOST" -; expect_status "resolve unknown" 404
emit_api "$f" "Signed, unknown host $UNKNOWN_HOST: 404" "/store/resolve?host=$UNKNOWN_HOST"
api_get "/store/resolve?host=$DEMO_HOST" unsigned; expect_status "resolve unsigned" 404
emit_api "$f" "Unsigned: 404, as if the route did not exist" "/store/resolve?host=$DEMO_HOST"

# --- store-products.md ----------------------------------------------------------------------------
f="$out/api/store-products.md"
begin "$f" "GET /store/products" "One page of the store's listed products, read from the per-store projection (D3205): active and visible only, never a draft or a hidden product. The store is the signed \`x-store-id\`, never a query parameter."
api_get '/store/products?take=4' "$demo_store"; expect_status "products ar" 200
assert_js "products ar" "b.items.length===4&&b.items.every((p)=>!$(node -e 'console.log(JSON.stringify(process.argv[1].split("\n")))' "$second_names").includes(p.name))" "$work/b"
emit_api "$f" "Signed for the Arabic store, take=4" '/store/products?take=4'
api_get '/store/products?sort=price-asc' "$en_store"; expect_status "products en" 200
assert_js "products en" "b.items.map((p)=>p.name).join()==='Ceramic mug,Canvas tote bag,Linen shirt'" "$work/b"
emit_api "$f" "Signed for the English store, sort=price-asc: its three products only" '/store/products?sort=price-asc'
api_get '/store/products' unsigned; expect_status "products unsigned" 404
emit_api "$f" "Unsigned: 404" '/store/products'

# --- store-product.md -----------------------------------------------------------------------------
f="$out/api/store-product.md"
begin "$f" "GET /store/product/:slug" "The product page of the signed store: options, variants with their prices and option codes, images as storage paths (D3209). Another store's slug and a draft answer an empty 404 (D3206)."
api_get "/store/product/$demo_product_slug" "$demo_store"; expect_status "product ar" 200
assert_js "product ar" "b.variants.length>1&&b.optionGroups.length>0" "$work/b"
emit_api "$f" "Signed for the Arabic store: $demo_product_name" "/store/product/$demo_product_slug"
api_get "/store/product/$demo_product_slug" "$second_store"; expect_status "product on fr" 404
[[ ! -s "$work/b" ]] || fail "the cross-store 404 has a body"
emit_api "$f" "The same slug signed for the French store: 404, empty" "/store/product/$demo_product_slug"
draft_path="/store/product/$(urlencode "$draft_slug")"
api_get "$draft_path" "$demo_store"; expect_status "draft" 404
emit_api "$f" "A draft's slug in its own store: 404" "$draft_path"

# --- store-search.md ------------------------------------------------------------------------------
f="$out/api/store-search.md"
begin "$f" "GET /store/product/search" "Arabic-aware search (ADR 0014): diacritics and letter variants are folded the same way in TypeScript and SQL, and a business's Darija synonyms map Latin-script words to the Arabic word a merchant writes."
search() { api_get "/store/product/search?q=$(urlencode "$1")" "$2"; expect_status "search $1" 200; }
search 'قميص' "$demo_store"
plain_hits=$(js 'b.items.map((p)=>p.id).join()' "$work/b")
assert_js "search plain" "b.items.length>0" "$work/b"
emit_api "$f" "q=قميص (no diacritics), Arabic store" "/store/product/search?q=$(urlencode 'قميص')"
search 'قَمِيص' "$demo_store"
assert_js "search diacritics" "b.items.map((p)=>p.id).join()==='$plain_hits'" "$work/b"
emit_api "$f" "q=قَمِيص (with fatha and kasra): the same hits" "/store/product/search?q=$(urlencode 'قَمِيص')"
search serwal "$demo_store"
assert_js "search darija" "b.items.length>0&&b.items[0].name==='$DARIJA_TITLE'" "$work/b"
emit_api "$f" "q=serwal (Latin-script Darija): $DARIJA_TITLE first" '/store/product/search?q=serwal'
search 'قميص' "$second_store"
assert_js "search on fr" "b.items.every((p)=>!$(node -e 'console.log(JSON.stringify(process.argv[1].split("\n")))' "$demo_names").includes(p.name))" "$work/b"
emit_api "$f" "q=قميص signed for the French store: none of the Arabic store's products" "/store/product/search?q=$(urlencode 'قميص')"

# --- store-collections.md -------------------------------------------------------------------------
f="$out/api/store-collections.md"
begin "$f" "GET /store/collections and /store/collection/:slug" "The store's visible collections by position, and one collection with the first page of its listed products (D3219 f). Another store's slug answers an empty 404."
api_get /store/collections "$demo_store"; expect_status "collections ar" 200
emit_api "$f" "Signed for the Arabic store" /store/collections
collection_path="/store/collection/$(urlencode "$demo_category_raw")?take=4"
api_get "$collection_path" "$demo_store"; expect_status "collection ar" 200
assert_js "collection ar" "b.collection.slug==='$demo_category_raw'&&b.products.items.length>0" "$work/b"
emit_api "$f" "Signed for the Arabic store: $demo_category_raw, take=4" "$collection_path"
api_get "$collection_path" "$second_store"; expect_status "collection on fr" 404
emit_api "$f" "The same slug signed for the French store: 404" "$collection_path"

# --- storefront-pages.md --------------------------------------------------------------------------
f="$out/api/storefront-pages.md"
begin "$f" "Storefront tenant pages" "\`GET\` on the storefront (instance A), the store chosen only by the \`Host\` header. Each tenant page carries \`cloudflare-cdn-cache-control\` for the edge (ADR 0006 §4) and never a \`set-cookie\`; the tenant wrapper carries the store's \`lang\` and \`dir\`. Bodies are cut to the tenant wrapper and the store name."
CDN_VALUE='max-age=60, stale-while-revalidate=600'
PAGE_TRIM='<div[^>]*class="theme-root"[^>]*>|<a[^>]*data-testid="store-name"[^>]*>[^<]*</a>'
page_check() { # page_check <label> <name> <dir> <other-names...>
  local label=$1 name=$2 dir=$3 other
  shift 3
  expect_status "$label" 200
  command grep -qi "^cloudflare-cdn-cache-control: $CDN_VALUE" "$work/h" || fail "$label: no CDN cache header"
  ! command grep -qi '^set-cookie:' "$work/h" || fail "$label: a set-cookie header"
  command grep -qF "$name" "$work/b" || fail "$label: no '$name'"
  command grep -qE "class=\"theme-root\"[^>]*dir=\"$dir\"|dir=\"$dir\"[^>]*class=\"theme-root\"" "$work/b" || fail "$label: the wrapper is not dir=$dir"
  for other in "$@"; do ! command grep -qF "$other" "$work/b" || fail "$label: shows $other"; done
}
for spec in "$DEMO_HOST|$DEMO_NAME|rtl|/" "$SECOND_HOST|$SECOND_NAME|ltr|/" "$EN_HOST|$EN_NAME|ltr|/" "$DEMO_HOST|$DEMO_NAME|rtl|/products" "$SECOND_HOST|$SECOND_NAME|ltr|/products"; do
  IFS='|' read -r host name dir path <<<"$spec"
  site_get "$site" "$path" "$host"
  others=()
  [[ "$name" != "$DEMO_NAME" ]] && others+=("$DEMO_NAME<")
  [[ "$name" != "$SECOND_NAME" ]] && others+=("$SECOND_NAME<")
  page_check "GET $path on $host" "$name" "$dir" "${others[@]}"
  emit_site "$f" "Host: $host, GET $path" GET "$site$path" "$PAGE_TRIM" "Host: $host" -
done
site_get "$site" / "$UNKNOWN_HOST"; expect_status "unknown host" 404
command grep -qF 'data-testid="not-found"' "$work/b" || fail "unknown host: no not-found marker"
emit_site "$f" "Host: $UNKNOWN_HOST (no store): 404" GET "$site/" '<main data-testid="not-found"[^>]*>' "Host: $UNKNOWN_HOST" -
site_get "$site" / "$UNKNOWN_HOST" "X-Forwarded-Host: $DEMO_HOST"; expect_status "forwarded host" 404
! command grep -qF "$DEMO_NAME" "$work/b" || fail "X-Forwarded-Host was trusted"
emit_site "$f" "Host: $UNKNOWN_HOST with X-Forwarded-Host: $DEMO_HOST: still 404 (the forwarded header is ignored)" GET "$site/" '<main data-testid="not-found"[^>]*>' "$(printf 'Host: %s\nX-Forwarded-Host: %s' "$UNKNOWN_HOST" "$DEMO_HOST")" -

# --- storefront-isolation.md ----------------------------------------------------------------------
f="$out/api/storefront-isolation.md"
begin "$f" "Storefront isolation" "A buyer on the Arabic store's host can never reach the French store: the internal tenant path \`/_t/{locale}/{storeId}/{binding}\` is refused from outside (here with the French store's real host binding, D3202), and a product slug is looked up in the host's own store only."
second_binding=$(SID="$second_store" H="$SECOND_HOST" node -e '
const { createHmac } = require("crypto");
const kid = process.env.INTERNAL_HMAC_ACTIVE_KID;
const entry = process.env.INTERNAL_HMAC_KEYS.split(",").find((e) => e.startsWith(kid + ":"));
const key = createHmac("sha256", entry.slice(kid.length + 1)).update("storefront-host-binding-v1").digest();
console.log(createHmac("sha256", key).update(process.env.SID + "\n" + process.env.H).digest("base64url").slice(0, 22));')
remember BINDING_SECOND "$second_binding"
for path in "/_t/fr/$second_store/$second_binding" "/%5Ft/fr/$second_store/$second_binding" "/_t/fr/$second_store/$second_binding/products"; do
  site_get "$site" "$path" "$DEMO_HOST"; expect_status "tenant path $path" 404
  ! command grep -qF "$SECOND_NAME" "$work/b" || fail "$path showed the French store"
  emit_site "$f" "Host: $DEMO_HOST, GET $path: 404" GET "$site$path" '<main data-testid="not-found"[^>]*>' "Host: $DEMO_HOST" -
done
site_get "$site" "/product/$demo_product_slug" "$SECOND_HOST"
[[ "$status" == 200 || "$status" == 404 ]] || fail "cross-host product: HTTP $status"
# Under Cache Components the page streams: notFound() inside the Suspense boundary reaches the browser as the 404
# fallback digest plus the tenant not-found tree in the RSC payload, which the browser renders (a soft 404, D3223 d).
command grep -qF 'NEXT_HTTP_ERROR_FALLBACK;404' "$work/b" || fail "cross-host product: no 404 fallback"
command grep -qF '\"data-testid\":\"not-found\"' "$work/b" || fail "cross-host product: no not-found tree"
command grep -qF '<meta name="robots" content="noindex"/>' "$work/b" || fail "cross-host product: not noindex"
! command grep -qF "$demo_product_name" "$work/b" || fail "the French host showed the Arabic product"
emit_site "$f" "Host: $SECOND_HOST, GET /product/<the Arabic store's slug>: HTTP $status with the 404 fallback and the not-found tree (a soft 404 under Cache Components, D3223 d), noindex, no Arabic product name anywhere in the body" GET "$site/product/$demo_product_slug" '<meta name="robots" content="noindex"/>|NEXT_HTTP_ERROR_FALLBACK;404|\\"data-testid\\":\\"not-found\\"' "Host: $SECOND_HOST" -

# --- storefront-store-api.md ----------------------------------------------------------------------
f="$out/api/storefront-store-api.md"
begin "$f" "Storefront /api/store/*" "The same-origin store API the browser calls (D3223 e): the store comes from the host, never from the client. A \`storeId\` naming another store answers an empty 400; a path outside the table or with dot segments an empty 404; every answer is \`private, no-store\`."
site_get "$site" /api/store/products "$DEMO_HOST"; expect_status "store api own" 200
command grep -qi '^cache-control: private, no-store' "$work/h" || fail "store api: not private, no-store"
assert_js "store api own" "b.items.length>0&&b.items.every((p)=>!$(node -e 'console.log(JSON.stringify(process.argv[1].split("\n")))' "$second_names").includes(p.name))" "$work/b"
node -e 'const fs=require("fs"); const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); b.items=b.items.slice(0,2); fs.writeFileSync(process.argv[1], JSON.stringify(b))' "$work/b"
emit_site "$f" "Host: $DEMO_HOST, GET /api/store/products (body cut by the script to its first two items)" GET "$site/api/store/products" - "Host: $DEMO_HOST" -
site_get "$site" "/api/store/products?storeId=$demo_store" "$SECOND_HOST"; expect_status "store api mismatch" 400
[[ ! -s "$work/b" ]] || fail "the mismatch 400 has a body"
emit_site "$f" "Host: $SECOND_HOST, GET /api/store/products?storeId=<the Arabic store>: 400, empty" GET "$site/api/store/products?storeId=$demo_store" - "Host: $SECOND_HOST" -
site_get "$site" '/api/store/product/..%2F..%2Fshop-api' "$DEMO_HOST"; expect_status "store api traversal" 404
[[ ! -s "$work/b" ]] || fail "the traversal 404 has a body"
emit_site "$f" "Host: $DEMO_HOST, GET /api/store/product/..%2F..%2Fshop-api: 404, empty" GET "$site/api/store/product/..%2F..%2Fshop-api" - "Host: $DEMO_HOST" -

# --- storefront-revalidate.md ---------------------------------------------------------------------
f="$out/api/storefront-revalidate.md"
begin "$f" "POST /api/internal/revalidate" "The api's revalidate worker expires storefront cache tags here (D3211). Anything that is not a signed call answers an empty 404, as if the route did not exist; a signed malformed body answers an empty 400; a signed call answers 200."
revalidate_url="$site/api/internal/revalidate"
printf '{"tags":["store:%s"]}' "$demo_store" >"$work/revalidate.json"
post_revalidate() { # post_revalidate <base-url> <body-file> <signed|unsigned> -> $status
  local -a args=(-sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "Host: $DEMO_HOST" -H "$json" --data-binary "@$2")
  if [[ "$3" == signed ]]; then sign_for POST /api/internal/revalidate - "$2"; args+=("${SIGN_ARGS[@]}"); fi
  status=$(curl "${args[@]}" -w '%{http_code}' "$1/api/internal/revalidate") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $1/api/internal/revalidate"
}
post_revalidate "$site" "$work/revalidate.json" unsigned; expect_status "revalidate unsigned" 404
[[ ! -s "$work/b" ]] || fail "the unsigned 404 has a body"
emit_site "$f" "Unsigned: 404, empty" POST "$revalidate_url" - "$(printf 'Host: %s\n%s' "$DEMO_HOST" "$json")" "$(command cat "$work/revalidate.json")"
printf '{"tags":["not-a-tag"]}' >"$work/revalidate-bad.json"
post_revalidate "$site" "$work/revalidate-bad.json" signed; expect_status "revalidate malformed" 400
emit_site "$f" "Signed, a tag that is not a storefront cache tag: 400, empty" POST "$revalidate_url" - "$(printf 'Host: %s\n%s\n%s' "$DEMO_HOST" "$json" "$SIGN_SHOWN")" "$(command cat "$work/revalidate-bad.json")"
post_revalidate "$site" "$work/revalidate.json" signed; expect_status "revalidate signed" 200
emit_site "$f" "Signed: 200" POST "$revalidate_url" - "$(printf 'Host: %s\n%s\n%s' "$DEMO_HOST" "$json" "$SIGN_SHOWN")" "$(command cat "$work/revalidate.json")"
