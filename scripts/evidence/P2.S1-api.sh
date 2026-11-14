# shellcheck shell=bash
# The API part of scripts/evidence/P2.S1.sh, sourced by it after the sign-ins: every catalog operation over GraphQL and REST,
# the logo URLs and the cross-business refusals. Uses the driver's helpers and variables (owner, second_owner, demo, second,
# demo_store, second_store, out, work); sets matrix_id and hidden_id for the screens.

# --- synthetic files ----------------------------------------------------------------------------
# Small solid-colour PNGs, so the library tiles in the screenshots show something.
make_png() { # make_png <file> <r> <g> <b>
  node -e '
const zlib = require("zlib"), fs = require("fs");
const [file, r, g, b] = process.argv.slice(1); const size = 96;
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([+r, +g, +b]).flat())]);
const raw = Buffer.concat(Array(size).fill(row));
fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));' "$1" "$2" "$3" "$4"
}
make_png "$work/red.png" 200 60 60
make_png "$work/blue.png" 60 90 200
make_png "$work/green.png" 60 160 90
make_png "$work/grey.png" 140 140 140
make_png "$work/logo.png" 30 120 110
printf '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>' >"$work/image.svg"
node -e 'const b = Buffer.alloc(+process.argv[2]); b.set([0xff, 0xd8, 0xff, 0xe0]); require("fs").writeFileSync(process.argv[1], b)' \
  "$work/big.jpg" "$MEDIA_TOO_LARGE_BYTES"
urlencode() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }

PRODUCT_FIELDS='id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders }'
Q_PRODUCTS='query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }'
Q_PRODUCT="query (\$id: ID!) { catalogProduct(id: \$id) { $PRODUCT_FIELDS } }"
Q_CREATE_PRODUCT="mutation (\$input: CreateCatalogProductInput!) { createCatalogProduct(input: \$input) { warnings product { $PRODUCT_FIELDS } } }"
Q_UPDATE_PRODUCT="mutation (\$id: ID!, \$input: UpdateCatalogProductInput!) { updateCatalogProduct(id: \$id, input: \$input) { warnings product { $PRODUCT_FIELDS } } }"
Q_STATUS='mutation ($id: ID!, $status: CatalogProductStatus!) { setCatalogProductStatus(id: $id, status: $status) { id title status } }'
Q_DELETE_PRODUCT='mutation ($id: ID!) { deleteCatalogProduct(id: $id) }'
Q_SLUG='query ($slug: String!, $productId: ID) { catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }'

# --- taxonomy.md --------------------------------------------------------------------------------
f="$out/api/taxonomy.md"
begin "$f" "Brands, tags and highlights" "Each belongs to one store of one business (D2100); reads need \`catalog.products.view\`, writes \`catalog.products.edit\`. The REST routes mirror the GraphQL operations (D2102)."
taxonomy_cycle() { # taxonomy_cycle <kind> <Kind> <field> <first> <renamed> <rest-name> -> $KEPT_ID
  local kind=$1 Kind=$2 field=$3 list="catalog${2}s" fields="id $3"
  gql "query { $list { $fields } }" '{}' "$owner" "$demo"; expect_ok "$list"
  emit "$f" "$list: the store's ${kind}s (the seed's)" "query { $list { $fields } }" '{}' "$owner" "$demo"
  local q_create="mutation (\$input: Catalog${Kind}Input!) { createCatalog${Kind}(input: \$input) { $fields } }"
  local q_update="mutation (\$id: String!, \$input: Catalog${Kind}Input!) { updateCatalog${Kind}(id: \$id, input: \$input) { $fields } }"
  local q_delete="mutation (\$id: String!) { deleteCatalog${Kind}(id: \$id) }"
  gql "$q_create" "$(vars "{input:{$field:'$4'}}")" "$owner" "$demo"; expect_ok "create $kind"
  KEPT_ID=$(js "b.data.createCatalog${Kind}.id" "$work/b"); remember_id "${kind^^}_KEPT" "$KEPT_ID"
  emit "$f" "createCatalog${Kind}" "$q_create" "$(vars "{input:{$field:'$4'}}")" "$owner" "$demo"
  gql "$q_update" "$(vars "{id:'$KEPT_ID',input:{$field:'$5'}}")" "$owner" "$demo"; expect_ok "update $kind"
  assert_js "update $kind" "b.data.updateCatalog${Kind}.$field==='$5'" "$work/b"
  emit "$f" "updateCatalog${Kind}" "$q_update" "$(vars "{id:'$KEPT_ID',input:{$field:'$5'}}")" "$owner" "$demo"
  gql "$q_create" "$(vars "{input:{$field:'$6 (GraphQL)'}}")" "$owner" "$demo"; expect_ok "create $kind to delete"
  local doomed; doomed=$(js "b.data.createCatalog${Kind}.id" "$work/b"); remember_id "${kind^^}_DELETED" "$doomed"
  gql "$q_delete" "$(vars "{id:'$doomed'}")" "$owner" "$demo"; expect_ok "delete $kind"
  assert_js "delete $kind" "b.data.deleteCatalog${Kind}===true" "$work/b"
  emit "$f" "deleteCatalog${Kind}" "$q_delete" "$(vars "{id:'$doomed'}")" "$owner" "$demo"
  rest GET "/catalog/${kind}s" - "$owner" "$demo"; expect_status "GET ${kind}s" 200
  assert_js "GET ${kind}s" "b.some((x)=>x.id==='$KEPT_ID')" "$work/b"
  emit_rest "$f" "GET /catalog/${kind}s" GET "/catalog/${kind}s" -
  local body; body=$(vars "{$field:'$6'}")
  rest POST "/catalog/${kind}s" "$body" "$owner" "$demo"; expect_status "POST ${kind}s" 201
  local made; made=$(js 'b.id' "$work/b"); remember_id "${kind^^}_REST" "$made"
  emit_rest "$f" "POST /catalog/${kind}s" POST "/catalog/${kind}s" "$body"
  body=$(vars "{$field:'$6 2'}")
  rest PATCH "/catalog/${kind}s/$made" "$body" "$owner" "$demo"; expect_status "PATCH ${kind}s" 200
  emit_rest "$f" "PATCH /catalog/${kind}s/:id" PATCH "/catalog/${kind}s/$made" "$body"
  rest DELETE "/catalog/${kind}s/$made" - "$owner" "$demo"; expect_status "DELETE ${kind}s" 200
  emit_rest "$f" "DELETE /catalog/${kind}s/:id" DELETE "/catalog/${kind}s/$made" -
}
taxonomy_cycle brand Brand name 'علامة الأدلة' 'علامة الأدلة الجديدة' 'Evidence brand'
brand_id=$KEPT_ID
taxonomy_cycle tag Tag name 'صيفي' 'صيف' 'Evidence tag'
tag_id=$KEPT_ID
taxonomy_cycle highlight Highlight text 'قماش متين' 'قماش قطني متين' 'Evidence highlight'
highlight_id=$KEPT_ID

gql 'query { catalogHighlights { id } }' '{}' "$owner" "$demo"; expect_ok highlights
extra=0
while (($(js 'b.data.catalogHighlights.length' "$work/b") < 7)); do
  extra=$((extra + 1))
  gql 'mutation ($input: CatalogHighlightInput!) { createCatalogHighlight(input: $input) { id } }' \
    "$(vars "{input:{text:'ميزة إضافية $extra'}}")" "$owner" "$demo"; expect_ok "extra highlight"
  gql 'query { catalogHighlights { id } }' '{}' "$owner" "$demo"
done
seven=$(js 'b.data.catalogHighlights.slice(0,7).map((h)=>h.id)' "$work/b")
for id in $(js 'b.data.catalogHighlights.map((h)=>h.id).join(" ")' "$work/b"); do remember_id HIGHLIGHT "$id"; done
input=$(vars "{input:{title:'منتج بسبع مزايا',status:'active',price:1000,highlightIds:$seven}}")
gql "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"; expect_code "seven highlights" catalog.too-many-highlights
emit "$f" "A product with seven highlights: refused (at most six, AC3)" "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"

# --- products.md --------------------------------------------------------------------------------
f="$out/api/products.md"
begin "$f" "Products and variants" "Products of the active store (D2100, D2101): Color × Size makes four variants named \"<product> - <colour> / <size>\" with SKUs \`<sku>-1\`…\`-4\` (AC1). Titles are written in the store's language (Arabic here) whatever the display language (D2112)."
matrix_input=$(vars "{input:{title:'قميص رياضي للأدلة',status:'active',price:2500,oldPrice:3200,sku:'EVTEE',brandId:'$brand_id',tagIds:['$tag_id'],highlightIds:['$highlight_id'],optionGroups:[{name:'اللون',values:['أحمر','أزرق']},{name:'المقاس',values:['S','M']}]}}")
gql "$Q_CREATE_PRODUCT" "$matrix_input" "$owner" "$demo"; expect_ok "create matrix"
matrix_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
assert_js "matrix skus" "b.data.createCatalogProduct.product.variants.map((v)=>v.sku).join()==='EVTEE-1,EVTEE-2,EVTEE-3,EVTEE-4'" "$work/b"
assert_js "matrix names" "b.data.createCatalogProduct.product.variants[0].name==='قميص رياضي للأدلة - أحمر / S'" "$work/b"
emit "$f" "createCatalogProduct: Color (red, blue) × Size (S, M)" "$Q_CREATE_PRODUCT" "$matrix_input" "$owner" "$demo"
variant_ids=$(js 'b.data.createCatalogProduct.product.variants.map((v)=>v.id).join(" ")' "$work/b")
read -r v1 v2 _ <<<"$variant_ids"
input=$(vars "{id:'$matrix_id',input:{variants:[{id:'$v2',price:3100,barcode:'6130000000017'}]}}")
gql "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "update variant"
assert_js "one price" "b.data.updateCatalogProduct.product.variants.map((v)=>v.price).join()==='2500,3100,2500,2500'" "$work/b"
assert_js "skus kept" "b.data.updateCatalogProduct.product.variants.map((v)=>v.sku).join()==='EVTEE-1,EVTEE-2,EVTEE-3,EVTEE-4'" "$work/b"
emit "$f" "updateCatalogProduct: the second variant's price and barcode; the others keep theirs" "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"
input=$(vars "{id:'$matrix_id',input:{variants:[{id:'$v1',isHidden:true}]}}")
gql "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "hide variant"
assert_js "hidden" "b.data.updateCatalogProduct.product.variants.map((v)=>v.isHidden).join()==='true,false,false,false'" "$work/b"
emit "$f" "updateCatalogProduct: hiding one variant" "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'$matrix_id'}")" "$owner" "$demo"; expect_ok "get"
assert_js get "b.data.catalogProduct.variants.length===4" "$work/b"
emit "$f" "catalogProduct" "$Q_PRODUCT" "$(vars "{id:'$matrix_id'}")" "$owner" "$demo"

list() { # list <title> <options-js> <assertion>
  local input; input=$(vars "{options:$2}")
  gql "$Q_PRODUCTS" "$input" "$owner" "$demo"; expect_ok "list $1"
  assert_js "list $1" "$3" "$work/b"
  emit "$f" "catalogProducts: $1" "$Q_PRODUCTS" "$input" "$owner" "$demo"
}
list "All (the seed's five and the matrix product)" "{tab:'all'}" "b.data.catalogProducts.totalItems>=6"
list "Draft tab: drafts only" "{tab:'draft'}" "b.data.catalogProducts.items.length>0&&b.data.catalogProducts.items.every((p)=>p.status==='draft')"
list "search by name" "{q:'قميص رياضي'}" "b.data.catalogProducts.items.map((p)=>p.id).join()==='$matrix_id'"
list "search by a variant SKU" "{q:'EVTEE-3'}" "b.data.catalogProducts.items.map((p)=>p.id).join()==='$matrix_id'"
list "search by a variant barcode" "{q:'6130000000017'}" "b.data.catalogProducts.items.map((p)=>p.id).join()==='$matrix_id'"
list "brand and tag filters combined" "{brandId:'$brand_id',tagId:'$tag_id'}" "b.data.catalogProducts.items.map((p)=>p.id).join()==='$matrix_id'"

body=$(vars "{title:'منتج عبر REST',status:'active',price:2500,oldPrice:2000,sku:'EVREST'}")
rest POST /catalog/products "$body" "$owner" "$demo"; expect_status "POST product" 201
assert_js "price warning" "b.warnings.includes('catalog.old-price-below-price')" "$work/b"
rest_id=$(js 'b.product.id' "$work/b")
emit_rest "$f" "POST /catalog/products: an old price below the price warns, it does not block (AC3)" POST /catalog/products "$body"
rest GET "/catalog/products/$rest_id" - "$owner" "$demo"; expect_status "GET product" 200
emit_rest "$f" "GET /catalog/products/:id" GET "/catalog/products/$rest_id" -
body=$(vars "{label:'جديد',cardCaption:'عرض محدود'}")
rest PATCH "/catalog/products/$rest_id" "$body" "$owner" "$demo"; expect_status "PATCH product" 200
emit_rest "$f" "PATCH /catalog/products/:id" PATCH "/catalog/products/$rest_id" "$body"
body=$(vars "{status:'draft'}")
rest POST "/catalog/products/$rest_id/status" "$body" "$owner" "$demo"; expect_status "status" 200
assert_js status "b.status==='draft'" "$work/b"
emit_rest "$f" "POST /catalog/products/:id/status" POST "/catalog/products/$rest_id/status" "$body"
rest GET "/catalog/products?tab=draft&q=EVREST" - "$owner" "$demo"; expect_status "GET products" 200
assert_js "REST list" "b.items.map((p)=>p.id).join()==='$rest_id'" "$work/b"
emit_rest "$f" "GET /catalog/products?tab=draft&q=EVREST" GET "/catalog/products?tab=draft&q=EVREST" -
rest DELETE "/catalog/products/$rest_id" - "$owner" "$demo"; expect_status "DELETE product" 200
emit_rest "$f" "DELETE /catalog/products/:id" DELETE "/catalog/products/$rest_id" -
rest GET "/catalog/products/$rest_id" - "$owner" "$demo"; expect_rest_code "deleted" 404 catalog.product-not-found
emit_rest "$f" "GET /catalog/products/:id after the delete: 404" GET "/catalog/products/$rest_id" -

input=$(vars "{input:{title:'منتج مؤقت',status:'active',price:900}}")
gql "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "create temporary"
temp_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
gql "$Q_STATUS" "$(vars "{id:'$temp_id',status:'hidden'}")" "$owner" "$demo"; expect_ok "set status"
assert_js "set status" "b.data.setCatalogProductStatus.status==='hidden'" "$work/b"
emit "$f" "setCatalogProductStatus: Hidden" "$Q_STATUS" "$(vars "{id:'$temp_id',status:'hidden'}")" "$owner" "$demo"
gql "$Q_DELETE_PRODUCT" "$(vars "{id:'$temp_id'}")" "$owner" "$demo"; expect_ok "delete"
assert_js delete "b.data.deleteCatalogProduct===true" "$work/b"
emit "$f" "deleteCatalogProduct" "$Q_DELETE_PRODUCT" "$(vars "{id:'$temp_id'}")" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'$temp_id'}")" "$owner" "$demo"; expect_ok "deleted get"
assert_js "deleted get" "b.data.catalogProduct===null" "$work/b"
emit "$f" "catalogProduct after the delete: null" "$Q_PRODUCT" "$(vars "{id:'$temp_id'}")" "$owner" "$demo"

# --- slug-availability.md -------------------------------------------------------------------------
f="$out/api/slug-availability.md"
begin "$f" "Slug availability" "Slugs are unique per store (D2103). The check never tells one business about another's slugs (D500)."
ARABIC_SLUG='حذاء-رياضي-أحمر'
input=$(vars "{input:{title:'حذاء رياضي أحمر',status:'active',price:4500}}")
gql "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "arabic product"
shoe_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
assert_js "arabic slug" "b.data.createCatalogProduct.product.slug.normalize('NFC')==='$ARABIC_SLUG'" "$work/b"
emit "$f" "createCatalogProduct with an Arabic title: the slug follows it" "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"
gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$owner" "$demo"; expect_ok slug
assert_js "slug taken" "b.data.catalogSlugAvailability.available===false" "$work/b"
emit "$f" "The same Arabic slug in its store: taken" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$owner" "$demo"
gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG',productId:'$shoe_id'}")" "$owner" "$demo"; expect_ok "own slug"
assert_js "own slug" "b.data.catalogSlugAvailability.available===true" "$work/b"
emit "$f" "The product's own slug, while editing it: free" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG',productId:'$shoe_id'}")" "$owner" "$demo"
rest GET "/catalog/products/slug-availability?slug=$(urlencode "$ARABIC_SLUG")" - "$owner" "$demo"; expect_status "REST slug" 200
assert_js "REST slug" "b.available===false" "$work/b"
emit_rest "$f" "GET /catalog/products/slug-availability (the Arabic slug, URL-encoded): taken" GET "/catalog/products/slug-availability?slug=$(urlencode "$ARABIC_SLUG")" -
gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$second_owner" "$second"; expect_ok "slug in B"
assert_js "slug in B" "b.data.catalogSlugAvailability.available===true" "$work/b"
emit "$f" "The same slug in business B's store: free" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$second_owner" "$second"
input=$(vars "{input:{title:'Produit B',slug:'ev-b-only-slug',status:'active',price:1500}}")
gql "$Q_CREATE_PRODUCT" "$input" "$second_owner" "$second"; expect_ok "B product"
b_product=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
emit "$f" "Business B creates a product with slug ev-b-only-slug" "$Q_CREATE_PRODUCT" "$input" "$second_owner" "$second"
gql "$Q_SLUG" "$(vars "{slug:'ev-b-only-slug'}")" "$owner" "$demo"; expect_ok "B slug from A"
assert_js "B slug from A" "b.data.catalogSlugAvailability.available===true" "$work/b"
emit "$f" "Business A asks for B's slug: free in A's store (nothing about B leaks)" "$Q_SLUG" "$(vars "{slug:'ev-b-only-slug'}")" "$owner" "$demo"

# --- media.md -----------------------------------------------------------------------------------
f="$out/api/media.md"
begin "$f" "The media library" "The business's images (AC7, D2113): PNG, JPEG, GIF or WebP by their bytes, at most 5 242 880 bytes. The upload is a GraphQL multipart request only (D2102)."
MEDIA_FIELDS='id assetId url previewUrl mimeType width height fileSize'
Q_UPLOAD="mutation (\$file: Upload!) { uploadCatalogMedia(file: \$file) { $MEDIA_FIELDS } }"
Q_MEDIA="query (\$options: CatalogMediaListInput) { catalogMedia(options: \$options) { totalItems items { $MEDIA_FIELDS } } }"
Q_DELETE_MEDIA='mutation ($id: String!) { deleteCatalogMedia(id: $id) }'
media_ids=() asset_ids=()
for colour in red blue green grey; do
  upload "$Q_UPLOAD" "$work/$colour.png" image/png "$colour.png" "$owner" "$demo"; expect_ok "upload $colour"
  assert_js "upload $colour" "b.data.uploadCatalogMedia.mimeType==='image/png'" "$work/b"
  media_ids+=("$(js 'b.data.uploadCatalogMedia.id' "$work/b")"); asset_ids+=("$(js 'b.data.uploadCatalogMedia.assetId' "$work/b")")
  remember_id "MEDIA_${colour^^}" "${media_ids[-1]}"
  [[ "$colour" == red ]] && emit_upload "$f" "uploadCatalogMedia: a PNG" "$Q_UPLOAD" "red.png (image/png, $(command stat -c %s "$work/red.png") bytes)"
done
gql "$Q_MEDIA" '{"options":{"take":10}}' "$owner" "$demo"; expect_ok media
assert_js media "b.data.catalogMedia.totalItems===4" "$work/b"
assert_js "tenant key" "b.data.catalogMedia.items.every((m)=>m.url.includes('/s/$demo_store/'))" "$work/b"
emit "$f" "catalogMedia" "$Q_MEDIA" '{"options":{"take":10}}' "$owner" "$demo"
upload "$Q_UPLOAD" "$work/image.svg" image/svg+xml image.svg "$owner" "$demo"; expect_code svg catalog.media-type
emit_upload "$f" "uploadCatalogMedia: an SVG, refused" "$Q_UPLOAD" "image.svg (image/svg+xml, $(command stat -c %s "$work/image.svg") bytes)"
upload "$Q_UPLOAD" "$work/big.jpg" image/jpeg big.jpg "$owner" "$demo"; expect_code "too large" catalog.media-too-large
emit_upload "$f" "uploadCatalogMedia: a JPEG of 5 242 881 bytes, refused" "$Q_UPLOAD" "big.jpg (image/jpeg, $MEDIA_TOO_LARGE_BYTES bytes)"
rest GET '/catalog/media?take=10' - "$owner" "$demo"; expect_status "GET media" 200
assert_js "nothing stored" "b.totalItems===4" "$work/b"
emit_rest "$f" "GET /catalog/media: the refused files stored nothing" GET '/catalog/media?take=10' -
input=$(vars "{id:'$matrix_id',input:{assetIds:['${asset_ids[0]}','${asset_ids[1]}'],featuredAssetId:'${asset_ids[0]}'}}")
gql "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "attach"
assert_js attach "b.data.updateCatalogProduct.product.featuredAsset.id==='${asset_ids[0]}'" "$work/b"
emit "$f" "updateCatalogProduct: two library images, the red one featured" "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"
gql "$Q_DELETE_MEDIA" "$(vars "{id:'${media_ids[0]}'}")" "$owner" "$demo"; expect_code "in use" catalog.media-in-use
emit "$f" "deleteCatalogMedia of an image a product uses: refused (D2128)" "$Q_DELETE_MEDIA" "$(vars "{id:'${media_ids[0]}'}")" "$owner" "$demo"
gql "$Q_DELETE_MEDIA" "$(vars "{id:'${media_ids[3]}'}")" "$owner" "$demo"; expect_ok "delete media"
assert_js "delete media" "b.data.deleteCatalogMedia===true" "$work/b"
emit "$f" "deleteCatalogMedia of an unused image" "$Q_DELETE_MEDIA" "$(vars "{id:'${media_ids[3]}'}")" "$owner" "$demo"
rest DELETE "/catalog/media/${media_ids[2]}" - "$owner" "$demo"; expect_status "DELETE media" 200
emit_rest "$f" "DELETE /catalog/media/:id" DELETE "/catalog/media/${media_ids[2]}" -
gql "$Q_MEDIA" '{"options":{"take":10}}' "$second_owner" "$second"; expect_ok "B media"
assert_js "B media" "b.data.catalogMedia.totalItems===0" "$work/b"
emit "$f" "catalogMedia as business B: none of A's images" "$Q_MEDIA" '{"options":{"take":10}}' "$second_owner" "$second"

# --- sold-out.md --------------------------------------------------------------------------------
f="$out/api/sold-out.md"
begin "$f" "Sold-out products" "Until stock exists a product is sold out by its manual flag (D2107). \"Stop orders\" and \"Resume orders\" set \`allowOutOfStockOrders\` on the store's sold-out products; an empty list means all of them (D2108)."
gql "$Q_PRODUCTS" '{"options":{"tab":"all","take":50}}' "$owner" "$demo"; expect_ok "find hidden"
hidden_id=$(js "b.data.catalogProducts.items.find((p)=>p.status==='hidden').id" "$work/b")
[[ "$hidden_id" =~ ^[0-9]+$ ]] || fail "the seed made no hidden product"
input=$(vars "{id:'$hidden_id',input:{settings:{soldOut:true}}}")
gql "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "mark sold out"
assert_js "marked" "b.data.updateCatalogProduct.product.settings.soldOut===true" "$work/b"
emit "$f" "updateCatalogProduct: mark the seed's hidden product sold out" "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"
Q_SOLD_OUT='query { catalogSoldOutProducts { productId title allowOutOfStockOrders } }'
Q_STOP='mutation ($input: CatalogSoldOutOrdersInput!) { stopCatalogSoldOutOrders(input: $input) { productId title allowOutOfStockOrders } }'
Q_RESUME='mutation ($input: CatalogSoldOutOrdersInput!) { resumeCatalogSoldOutOrders(input: $input) { productId title allowOutOfStockOrders } }'
gql "$Q_SOLD_OUT" '{}' "$owner" "$demo"; expect_ok "sold out"
assert_js "sold out" "b.data.catalogSoldOutProducts.map((p)=>p.productId).join()==='$hidden_id'" "$work/b"
emit "$f" "catalogSoldOutProducts" "$Q_SOLD_OUT" '{}' "$owner" "$demo"
list_sold() { gql "$Q_PRODUCTS" '{"options":{"tab":"sold-out"}}' "$owner" "$demo"; expect_ok "sold-out tab"; }
list_sold
assert_js "sold-out tab" "b.data.catalogProducts.items.map((p)=>p.id).join()==='$hidden_id'" "$work/b"
emit "$f" "catalogProducts: the sold-out tab" "$Q_PRODUCTS" '{"options":{"tab":"sold-out"}}' "$owner" "$demo"
gql "$Q_STOP" '{"input":{"productIds":[]}}' "$owner" "$demo"; expect_ok stop
assert_js stop "b.data.stopCatalogSoldOutOrders.every((p)=>p.allowOutOfStockOrders===false)" "$work/b"
emit "$f" "stopCatalogSoldOutOrders: every sold-out product" "$Q_STOP" '{"input":{"productIds":[]}}' "$owner" "$demo"
gql "$Q_RESUME" "$(vars "{input:{productIds:['$hidden_id']}}")" "$owner" "$demo"; expect_ok resume
assert_js resume "b.data.resumeCatalogSoldOutOrders.every((p)=>p.allowOutOfStockOrders===true)" "$work/b"
emit "$f" "resumeCatalogSoldOutOrders: one product" "$Q_RESUME" "$(vars "{input:{productIds:['$hidden_id']}}")" "$owner" "$demo"
gql "$Q_RESUME" "$(vars "{input:{productIds:['$matrix_id']}}")" "$owner" "$demo"; expect_ok "resume not sold out"
assert_js "resume not sold out" "b.data.resumeCatalogSoldOutOrders.length===0" "$work/b"
emit "$f" "resumeCatalogSoldOutOrders on a product that is not sold out: nothing changes" "$Q_RESUME" "$(vars "{input:{productIds:['$matrix_id']}}")" "$owner" "$demo"
rest GET /catalog/sold-out-products - "$owner" "$demo"; expect_status "GET sold out" 200
emit_rest "$f" "GET /catalog/sold-out-products" GET /catalog/sold-out-products -
rest POST /catalog/sold-out-products/stop-orders '{"productIds":[]}' "$owner" "$demo"; expect_status "REST stop" 200
assert_js "REST stop" "b.every((p)=>p.allowOutOfStockOrders===false)" "$work/b"
emit_rest "$f" "POST /catalog/sold-out-products/stop-orders" POST /catalog/sold-out-products/stop-orders '{"productIds":[]}'
rest POST /catalog/sold-out-products/resume-orders '{}' "$owner" "$demo"; expect_status "REST resume" 200
assert_js "REST resume" "b.every((p)=>p.allowOutOfStockOrders===true)" "$work/b"
emit_rest "$f" "POST /catalog/sold-out-products/resume-orders (no list: every sold-out product)" POST /catalog/sold-out-products/resume-orders '{}'

# --- logo-url.md --------------------------------------------------------------------------------
f="$out/api/logo-url.md"
begin "$f" "Business and store logo URLs" "\`logoUrl\` resolves only an asset the business (or the store's own channel) holds (D2120)."
Q_LOGO='mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }'
upload "$Q_LOGO" "$work/logo.png" image/png logo.png "$owner" "$demo"; expect_ok logo
logo_asset=$(js 'b.data.uploadBusinessLogo.assetId' "$work/b")
emit_upload "$f" "uploadBusinessLogo" "$Q_LOGO" "logo.png (image/png, $(command stat -c %s "$work/logo.png") bytes)"
Q_UPDATE_BUSINESS='mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id logoAssetId logoUrl } }'
gql "$Q_UPDATE_BUSINESS" "$(vars "{input:{logoAssetId:'$logo_asset'}}")" "$owner" "$demo"; expect_ok "business logo"
remember_id BUSINESS_DEMO "$(js 'b.data.updateBusiness.id' "$work/b")"
emit "$f" "updateBusiness: the logo" "$Q_UPDATE_BUSINESS" "$(vars "{input:{logoAssetId:'$logo_asset'}}")" "$owner" "$demo"
Q_UPDATE_STORE='mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id logoAssetId logoUrl showAddressField soldOutBehavior } }'
gql "$Q_UPDATE_STORE" "$(vars "{id:'$demo_store',input:{logoAssetId:'$logo_asset'}}")" "$owner" "$demo"; expect_ok "store logo"
emit "$f" "updateStore: the same logo for the store" "$Q_UPDATE_STORE" "$(vars "{id:'$demo_store',input:{logoAssetId:'$logo_asset'}}")" "$owner" "$demo"
Q_ACTIVE_BUSINESS='query { activeBusiness { id name logoAssetId logoUrl } }'
gql "$Q_ACTIVE_BUSINESS" '{}' "$owner" "$demo"; expect_ok "active business"
assert_js "business logoUrl" "typeof b.data.activeBusiness.logoUrl==='string'&&b.data.activeBusiness.logoUrl.length>0" "$work/b"
emit "$f" "activeBusiness: logoUrl" "$Q_ACTIVE_BUSINESS" '{}' "$owner" "$demo"
Q_STORE='query ($id: String!) { store(id: $id) { id name logoAssetId logoUrl } }'
gql "$Q_STORE" "$(vars "{id:'$demo_store'}")" "$owner" "$demo"; expect_ok store
assert_js "store logoUrl" "typeof b.data.store.logoUrl==='string'&&b.data.store.logoUrl.length>0" "$work/b"
emit "$f" "store: logoUrl" "$Q_STORE" "$(vars "{id:'$demo_store'}")" "$owner" "$demo"
gql "$Q_ACTIVE_BUSINESS" '{}' "$second_owner" "$second"; expect_ok "B business"
remember_id BUSINESS_SECOND "$(js 'b.data.activeBusiness.id' "$work/b")"
assert_js "B logoUrl" "b.data.activeBusiness.logoUrl===null" "$work/b"
emit "$f" "activeBusiness as business B: no logo" "$Q_ACTIVE_BUSINESS" '{}' "$second_owner" "$second"

# --- isolation.md -------------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Business A against business B's catalog" "A foreign id answers exactly like an unknown one (D2136); another business's channel token is refused outright."
gql "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$owner" "$demo"; expect_ok "A reads B"
assert_js "A reads B" "b.data.catalogProduct===null" "$work/b"
emit "$f" "catalogProduct with B's product id, A's session on A's store: null" "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$owner" "$demo"
rest GET "/catalog/products/$b_product" - "$owner" "$demo"; expect_rest_code "A REST reads B" 404 catalog.product-not-found
emit_rest "$f" "GET /catalog/products/<B's product>: 404" GET "/catalog/products/$b_product" -
input=$(vars "{id:'$b_product',input:{label:'x'}}")
gql "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"; expect_code "A edits B" catalog.product-not-found
emit "$f" "updateCatalogProduct of B's product: not found" "$Q_UPDATE_PRODUCT" "$input" "$owner" "$demo"
rest DELETE "/catalog/products/$b_product" - "$owner" "$demo"; expect_rest_code "A deletes B" 404 catalog.product-not-found
emit_rest "$f" "DELETE /catalog/products/<B's product>: 404" DELETE "/catalog/products/$b_product" -
gql 'query { catalogBrands { id name } }' '{}' "$second_owner" "$second"; expect_ok "B brands"
b_brand=$(js 'b.data.catalogBrands[0].id' "$work/b"); remember_id BRAND_OF_B "$b_brand"
input=$(vars "{input:{title:'منتج بعلامة أجنبية',status:'active',price:1000,brandId:'$b_brand'}}")
gql "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"; expect_code "foreign brand" catalog.brand-not-found
emit "$f" "createCatalogProduct with B's brand id: not found" "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$second_owner" "$second"; expect_ok "B still has it"
assert_js "B still has it" "b.data.catalogProduct.id==='$b_product'" "$work/b"
emit "$f" "B reads its product: unchanged by A's attempts" "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$second_owner" "$second"
gql "$Q_PRODUCTS" '{}' "$owner" "$second"; expect_code "A on B's channel" FORBIDDEN
emit "$f" "catalogProducts, A's session with B's channel token: FORBIDDEN" "$Q_PRODUCTS" '{}' "$owner" "$second"
rest GET /catalog/products - "$owner" "$second"; expect_status "A REST on B's channel" 403
emit_rest "$f" "GET /catalog/products, A's session with B's channel token: 403" GET /catalog/products -
gql "$Q_PRODUCTS" '{}' - "$demo"; expect_code anonymous FORBIDDEN
emit "$f" "catalogProducts without a session: FORBIDDEN" "$Q_PRODUCTS" '{}' - "$demo"
