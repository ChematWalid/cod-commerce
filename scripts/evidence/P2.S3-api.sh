# shellcheck shell=bash
# The first API part of scripts/evidence/P2.S3.sh, sourced by it after the sign-ins: the synthetic catalog the rules run
# over, then collections.md, rules.md and manual.md. Uses the driver's helpers and variables (owner, second_owner, demo,
# second, out, work); sets the products (p1…p5, b_product), tags, the collections later parts and the screens use.

# --- synthetic catalog ----------------------------------------------------------------------------
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
urlencode() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }
Q_CREATE_TAG='mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id name } }'
Q_CREATE_BRAND='mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id name } }'
Q_CREATE_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id title variants { id price isHidden optionValues } } } }'
Q_UPDATE_PRODUCT='mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { product { id title tagIds variants { id price isHidden optionValues } } } }'
COLOR='اللون' RED='أحمر' BLUE='أزرق' GREEN='أخضر'

make_tag() { # make_tag <placeholder> <name> <session> <channel> -> $MADE
  gql "$Q_CREATE_TAG" "$(vars "{input:{name:'$2'}}")" "$3" "$4"; expect_ok "tag $2"
  MADE=$(js 'b.data.createCatalogTag.id' "$work/b"); remember_id "$1" "$MADE"
}
make_product() { # make_product <input-js> <session> <channel> -> $MADE (product id), $work/b
  gql "$Q_CREATE_PRODUCT" "$(vars "{input:$1}")" "$2" "$3"; expect_ok "product $1"
  MADE=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
}
make_tag TAG_PROMO 'ترويج الأدلة' "$owner" "$demo"; tag_promo=$MADE
make_tag TAG_NEW 'جديد الأدلة' "$owner" "$demo"; tag_new=$MADE
gql "$Q_CREATE_BRAND" "$(vars "{input:{name:'علامة الأدلة'}}")" "$owner" "$demo"; expect_ok brand
brand_id=$(js 'b.data.createCatalogBrand.id' "$work/b"); remember_id BRAND_DEMO "$brand_id"
make_product "{title:'حذاء جري أحمر',status:'active',price:2500,oldPrice:3200,brandId:'$brand_id',tagIds:['$tag_promo'],optionGroups:[{name:'$COLOR',values:['$RED','$BLUE']}]}" "$owner" "$demo"; p1=$MADE
make_product "{title:'حذاء جري أزرق',status:'active',price:2800,tagIds:['$tag_promo'],optionGroups:[{name:'$COLOR',values:['$BLUE']}]}" "$owner" "$demo"; p2=$MADE
make_product "{title:'قميص قطني أحمر',status:'active',price:1500,optionGroups:[{name:'$COLOR',values:['$RED']}]}" "$owner" "$demo"; p3=$MADE
p3_variant=$(js 'b.data.createCatalogProduct.product.variants[0].id' "$work/b")
make_product "{title:'حقيبة جري',status:'active',price:6000,tagIds:['$tag_promo']}" "$owner" "$demo"; p4=$MADE
make_product "{title:'قبعة صيفية',status:'active',price:1200,optionGroups:[{name:'$COLOR',values:['$RED','$GREEN']}]}" "$owner" "$demo"; p5=$MADE
p5_red=$(js "b.data.createCatalogProduct.product.variants.find((v)=>JSON.stringify(v.optionValues).includes('$RED')).id" "$work/b")
gql "$Q_UPDATE_PRODUCT" "$(vars "{id:'$p5',input:{variants:[{id:'$p5_red',isHidden:true}]}}")" "$owner" "$demo"; expect_ok "hide red cap"
make_tag TAG_OF_B 'B evidence tag' "$second_owner" "$second"; tag_b=$MADE
make_product "{title:'حذاء جري من المتجر ب',status:'active',price:2500,tagIds:['$tag_b']}" "$second_owner" "$second"; b_product=$MADE
# The Add products dialog of the screens searches this word: it names p1, p2 and p4, never business B's product.
pick_search='جري' pick_titles='حذاء جري أحمر|حذاء جري أزرق|حقيبة جري'

make_png "$work/cover.png" 200 90 60
Q_UPLOAD='mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId } }'
upload "$Q_UPLOAD" "$work/cover.png" image/png cover.png "$owner" "$demo"; expect_ok "upload cover"
cover_asset=$(js 'b.data.uploadCatalogMedia.assetId' "$work/b")

COLLECTION_FIELDS='id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount'
Q_COLLECTIONS="query (\$options: StoreCollectionListInput) { storeCollections(options: \$options) { totalItems items { id title slug mode visible position productCount } } }"
Q_COLLECTION="query (\$id: ID!) { storeCollection(id: \$id) { $COLLECTION_FIELDS } }"
Q_CREATE="mutation (\$input: CreateStoreCollectionInput!) { createStoreCollection(input: \$input) { $COLLECTION_FIELDS } }"
Q_UPDATE="mutation (\$id: ID!, \$input: UpdateStoreCollectionInput!) { updateStoreCollection(id: \$id, input: \$input) { $COLLECTION_FIELDS } }"
Q_DELETE='mutation ($id: ID!) { deleteStoreCollection(id: $id) }'
Q_MEMBERS='query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }'
Q_SLUG='query ($slug: String!, $collectionId: ID) { storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }'
MEMBERS_PAGE='{take:50}'

members() { # members <id> <session> <channel>
  gql "$Q_MEMBERS" "$(vars "{id:'$1',options:$MEMBERS_PAGE}")" "$2" "$3"; expect_ok "members of $1"
}
member_ids() { js 'b.data.storeCollectionProducts.items.map((p)=>p.productId)' "$work/b"; }
# poll_members <id> <assertion over ids> <label>: membership is written by the worker after the outbox delivers the event.
poll_members() {
  local deadline=$((SECONDS + RECOMPUTE_WAIT_SECONDS))
  while :; do
    members "$1" "$owner" "$demo"
    [[ "$(IDS=$(member_ids) node -e "const ids=JSON.parse(process.env.IDS); console.log($2)")" == true ]] && return 0
    ((SECONDS < deadline)) || fail "$3: membership of $1 is $(member_ids) after ${RECOMPUTE_WAIT_SECONDS}s"
    sleep 2
  done
}
create() { # create <label> <input-js> <session> <channel> -> $MADE
  gql "$Q_CREATE" "$(vars "{input:$2}")" "$3" "$4"; expect_ok "create $1"
  MADE=$(js 'b.data.createStoreCollection.id' "$work/b")
}

# --- collections.md -------------------------------------------------------------------------------
f="$out/api/collections.md"
begin "$f" "Store collections" "Collections of the active store (D2300, D2314): reads need \`catalog.collections.view\`, create \`.create\`, edit \`.edit\`, delete \`.delete\`. The REST routes under \`/catalog/collections\` mirror the GraphQL operations (D2315). Titles are written in the store's language (Arabic here, D2112)."
ARABIC_SLUG='تخفيضات-الصيف'
input="{title:'تخفيضات الصيف',description:'مختارات الصيف بأسعار مخفضة',visible:true,position:1,mode:'manual'}"
create summer "$input" "$owner" "$demo"; summer=$MADE
assert_js "arabic slug" "b.data.createStoreCollection.slug.normalize('NFC')==='$ARABIC_SLUG'&&b.data.createStoreCollection.productCount===0" "$work/b"
emit "$f" "createStoreCollection: a manual collection with an Arabic title, whose slug follows it" "$Q_CREATE" "$(vars "{input:$input}")" "$owner" "$demo"
body=$(vars "{title:'إكسسوارات',slug:'accessories',visible:true,position:2,mode:'manual'}")
rest POST /catalog/collections "$body" "$owner" "$demo"; expect_status "POST collection" 201
accessories=$(js 'b.id' "$work/b")
emit_rest "$f" "POST /catalog/collections: 201" POST /catalog/collections "$body"
gql "$Q_COLLECTIONS" '{"options":{"take":20}}' "$owner" "$demo"; expect_ok list
assert_js list "['$summer','$accessories'].every((id)=>b.data.storeCollections.items.some((c)=>c.id===id))" "$work/b"
emit "$f" "storeCollections" "$Q_COLLECTIONS" '{"options":{"take":20}}' "$owner" "$demo"
rest GET "/catalog/collections?search=$(urlencode 'الصيف')" - "$owner" "$demo"; expect_status "GET collections" 200
assert_js "REST search" "b.items.map((c)=>c.id).join()==='$summer'" "$work/b"
emit_rest "$f" "GET /catalog/collections?search=الصيف (URL-encoded)" GET "/catalog/collections?search=$(urlencode 'الصيف')" -
gql "$Q_COLLECTION" "$(vars "{id:'$summer'}")" "$owner" "$demo"; expect_ok get
emit "$f" "storeCollection" "$Q_COLLECTION" "$(vars "{id:'$summer'}")" "$owner" "$demo"
rest GET "/catalog/collections/$accessories" - "$owner" "$demo"; expect_status "GET collection" 200
emit_rest "$f" "GET /catalog/collections/:id" GET "/catalog/collections/$accessories" -
input="{id:'$summer',input:{featuredAssetId:'$cover_asset',position:0}}"
gql "$Q_UPDATE" "$(vars "$input")" "$owner" "$demo"; expect_ok update
assert_js update "b.data.updateStoreCollection.featuredAsset.id==='$cover_asset'&&b.data.updateStoreCollection.position===0" "$work/b"
emit "$f" "updateStoreCollection: an image from the media library and position 0" "$Q_UPDATE" "$(vars "$input")" "$owner" "$demo"
body='{"visible":false}'
rest PATCH "/catalog/collections/$accessories" "$body" "$owner" "$demo"; expect_status "PATCH collection" 200
assert_js PATCH "b.visible===false" "$work/b"
emit_rest "$f" "PATCH /catalog/collections/:id: hidden" PATCH "/catalog/collections/$accessories" "$body"

gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$owner" "$demo"; expect_ok slug
assert_js "slug taken" "b.data.storeCollectionSlugAvailability.available===false" "$work/b"
emit "$f" "storeCollectionSlugAvailability: the Arabic slug in its store, taken" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$owner" "$demo"
gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG',collectionId:'$summer'}")" "$owner" "$demo"; expect_ok "own slug"
assert_js "own slug" "b.data.storeCollectionSlugAvailability.available===true" "$work/b"
emit "$f" "The collection's own slug while editing it: free" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG',collectionId:'$summer'}")" "$owner" "$demo"
rest GET "/catalog/collections/slug-availability?slug=$(urlencode "$ARABIC_SLUG")" - "$owner" "$demo"; expect_status "REST slug" 200
assert_js "REST slug" "b.available===false" "$work/b"
emit_rest "$f" "GET /catalog/collections/slug-availability (the Arabic slug, URL-encoded): taken" GET "/catalog/collections/slug-availability?slug=$(urlencode "$ARABIC_SLUG")" -
gql "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$second_owner" "$second"; expect_ok "slug in B"
assert_js "slug in B" "b.data.storeCollectionSlugAvailability.available===true" "$work/b"
emit "$f" "The same slug in business B's store: free" "$Q_SLUG" "$(vars "{slug:'$ARABIC_SLUG'}")" "$second_owner" "$second"
input="{title:'Collection B',slug:'ev-b-collection',visible:true,position:0,mode:'manual'}"
create "B" "$input" "$second_owner" "$second"; b_collection=$MADE
emit "$f" "Business B creates a collection with slug ev-b-collection" "$Q_CREATE" "$(vars "{input:$input}")" "$second_owner" "$second"
gql "$Q_SLUG" '{"slug":"ev-b-collection"}' "$owner" "$demo"; expect_ok "B slug from A"
assert_js "B slug from A" "b.data.storeCollectionSlugAvailability.available===true" "$work/b"
emit "$f" "Business A asks for B's slug: free in A's store (nothing about B leaks)" "$Q_SLUG" '{"slug":"ev-b-collection"}' "$owner" "$demo"
input="{input:{title:'تخفيضات أخرى',slug:'$ARABIC_SLUG',visible:true,position:3,mode:'manual'}}"
gql "$Q_CREATE" "$(vars "$input")" "$owner" "$demo"; expect_code "slug taken" collections.slug-taken
emit "$f" "createStoreCollection with a slug the store already uses: refused" "$Q_CREATE" "$(vars "$input")" "$owner" "$demo"
body=$(vars "{title:'تخفيضات أخرى',slug:'$ARABIC_SLUG',visible:true,position:3,mode:'manual'}")
rest POST /catalog/collections "$body" "$owner" "$demo"; expect_rest_code "REST slug taken" 409 collections.slug-taken
emit_rest "$f" "POST /catalog/collections with the taken slug: 409" POST /catalog/collections "$body"

create temporary "{title:'مجموعة مؤقتة',visible:true,position:4,mode:'manual'}" "$owner" "$demo"; temporary=$MADE
gql "$Q_DELETE" "$(vars "{id:'$temporary'}")" "$owner" "$demo"; expect_ok delete
assert_js delete "b.data.deleteStoreCollection===true" "$work/b"
emit "$f" "deleteStoreCollection" "$Q_DELETE" "$(vars "{id:'$temporary'}")" "$owner" "$demo"
gql "$Q_COLLECTION" "$(vars "{id:'$temporary'}")" "$owner" "$demo"; expect_ok "deleted get"
assert_js "deleted get" "b.data.storeCollection===null" "$work/b"
emit "$f" "storeCollection after the delete: null" "$Q_COLLECTION" "$(vars "{id:'$temporary'}")" "$owner" "$demo"
rest DELETE "/catalog/collections/$accessories" - "$owner" "$demo"; expect_status "DELETE collection" 200
emit_rest "$f" "DELETE /catalog/collections/:id" DELETE "/catalog/collections/$accessories" -
rest GET "/catalog/collections/$accessories" - "$owner" "$demo"; expect_rest_code "deleted" 404 collections.not-found
emit_rest "$f" "GET /catalog/collections/:id after the delete: 404" GET "/catalog/collections/$accessories" -

# --- rules.md -------------------------------------------------------------------------------------
f="$out/api/rules.md"
begin "$f" "Automatic collections" "A rule is All (every condition) or Any (at least one) over Tag, Brand, Price, On sale, Title and option conditions (D2303). Price and option conditions read visible variants only. Products of this transcript: p1 \`$p1\` حذاء جري أحمر (2500, promo tag, red and blue), p2 \`$p2\` حذاء جري أزرق (2800, promo, blue), p3 \`$p3\` قميص قطني أحمر (1500, red), p4 \`$p4\` حقيبة جري (6000, promo, no colour), p5 \`$p5\` قبعة صيفية (1200, red hidden, green)."
promo_tag="{field:'tag',operator:'is_any_of',values:['$tag_promo']}"
mid_price="{field:'price',operator:'between',min:2000,max:5000}"
red_color="{field:'option',option:'$COLOR',operator:'is_any_of',values:['$RED']}"
all_rule="{version:1,match:'all',conditions:[$promo_tag,$mid_price,$red_color]}"
any_rule="{version:1,match:'any',conditions:[$promo_tag,$mid_price,$red_color]}"
auto_all_title='أحذية ترويجية حمراء'
input="{title:'$auto_all_title',featuredAssetId:'$cover_asset',visible:true,position:2,mode:'automatic',rule:$all_rule}"
create "AC1 all" "$input" "$owner" "$demo"; auto_all_id=$MADE
emit "$f" "AC1: createStoreCollection, All of Tag is any of [promo], Price 2000-5000, اللون is any of [أحمر]" "$Q_CREATE" "$(vars "{input:$input}")" "$owner" "$demo"
poll_members "$auto_all_id" "ids.join()==='$p1'" "AC1 all"
emit "$f" "storeCollectionProducts of the All collection: p1 only" "$Q_MEMBERS" "$(vars "{id:'$auto_all_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"
body=$(vars "{title:'أي شرط',visible:true,position:3,mode:'automatic',rule:$any_rule}")
rest POST /catalog/collections "$body" "$owner" "$demo"; expect_status "POST any" 201
auto_any_id=$(js 'b.id' "$work/b")
emit_rest "$f" "AC1: POST /catalog/collections, the same three conditions with Any" POST /catalog/collections "$body"
poll_members "$auto_any_id" "['$p1','$p2','$p3','$p4'].every((id)=>ids.includes(id))&&!ids.includes('$p5')" "AC1 any"
rest GET "/catalog/collections/$auto_any_id/products?take=50" - "$owner" "$demo"; expect_status "GET any members" 200
# Besides p1-p4 only the seed's products can match, and those have no promo tag or red variant: their price is in range.
assert_js "any members" "['$p1','$p2','$p3','$p4'].every((id)=>b.items.some((p)=>p.productId===id))&&!b.items.some((p)=>p.productId==='$p5')&&b.items.every((p)=>['$p1','$p2','$p3','$p4'].includes(p.productId)||(p.price>=2000&&p.price<=5000))&&b.totalItems===b.items.length" "$work/b"
emit_rest "$f" "GET /catalog/collections/:id/products of the Any collection: p1-p4 and the seed's shirt (price in range), not p5 (its only red variant is hidden, 1200 is out of range, no promo tag)" GET "/catalog/collections/$auto_any_id/products?take=50" -

not_promo="{version:1,match:'all',conditions:[{field:'tag',operator:'is_not',values:['$tag_promo']}]}"
input="{title:'بدون ترويج',visible:false,position:5,mode:'automatic',rule:$not_promo}"
create "AC2" "$input" "$owner" "$demo"; not_promo_id=$MADE
emit "$f" "AC2: createStoreCollection, Tag is not [promo]" "$Q_CREATE" "$(vars "{input:$input}")" "$owner" "$demo"
poll_members "$not_promo_id" "ids.includes('$p3')&&ids.includes('$p5')&&!['$p1','$p2','$p4'].some((id)=>ids.includes(id))" "AC2"
emit "$f" "storeCollectionProducts of Tag is not [promo]: p3 and p5 with the seed's products, none of p1, p2, p4" "$Q_MEMBERS" "$(vars "{id:'$not_promo_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"

Q_VARIANTS='query ($id: ID!) { catalogProduct(id: $id) { id title variants { id isHidden optionValues } } }'
gql "$Q_VARIANTS" "$(vars "{id:'$p5'}")" "$owner" "$demo"; expect_ok "p5 variants"
assert_js "p5 red hidden" "b.data.catalogProduct.variants.find((v)=>v.id==='$p5_red').isHidden===true" "$work/b"
emit "$f" "AC3: p5's red variant is hidden" "$Q_VARIANTS" "$(vars "{id:'$p5'}")" "$owner" "$demo"
body=$(vars "{title:'كل الأحمر',visible:true,position:4,mode:'automatic',rule:{version:1,match:'all',conditions:[$red_color]}}")
rest POST /catalog/collections "$body" "$owner" "$demo"; expect_status "POST red" 201
red_id=$(js 'b.id' "$work/b")
emit_rest "$f" "AC3: POST /catalog/collections, اللون is any of [أحمر]" POST /catalog/collections "$body"
poll_members "$red_id" "ids.includes('$p1')&&ids.includes('$p3')&&!ids.includes('$p5')&&!ids.includes('$p2')" "AC3"
rest GET "/catalog/collections/$red_id/products?take=50" - "$owner" "$demo"; expect_status "GET red members" 200
emit_rest "$f" "GET /catalog/collections/:id/products: p1 and p3, not p5 (red only on a hidden variant) nor p2 (blue)" GET "/catalog/collections/$red_id/products?take=50" -
not_red="{field:'option',option:'$COLOR',operator:'is_not',values:['$RED']}"
input="{title:'بلا أحمر',visible:false,position:7,mode:'automatic',rule:{version:1,match:'all',conditions:[$not_red]}}"
create "AC3 not red" "$input" "$owner" "$demo"; not_red_id=$MADE
emit "$f" "AC3: createStoreCollection, اللون is not [أحمر]" "$Q_CREATE" "$(vars "{input:$input}")" "$owner" "$demo"
poll_members "$not_red_id" "ids.includes('$p5')&&ids.includes('$p4')&&ids.includes('$p2')&&!ids.includes('$p1')&&!ids.includes('$p3')" "AC3 not red"
rest GET "/catalog/collections/$not_red_id/products?take=50" - "$owner" "$demo"; expect_status "GET not-red members" 200
emit_rest "$f" "GET /catalog/collections/:id/products of اللون is not [أحمر]: p5 (its red variant is hidden), p4 (no colour) and p2 (blue), neither p1 nor p3" GET "/catalog/collections/$not_red_id/products?take=50" -

bad_rule="{version:1,match:'all',conditions:[{field:'price',operator:'between',min:5000,max:1000}]}"
input="{input:{title:'قاعدة خاطئة',visible:true,position:6,mode:'automatic',rule:$bad_rule}}"
gql "$Q_CREATE" "$(vars "$input")" "$owner" "$demo"; expect_code "bad rule" collections.rule-invalid
emit "$f" "createStoreCollection with a price range whose minimum is above its maximum: refused" "$Q_CREATE" "$(vars "$input")" "$owner" "$demo"
body=$(vars "{title:'قاعدة خاطئة',visible:true,position:6,mode:'automatic',rule:$bad_rule}")
rest POST /catalog/collections "$body" "$owner" "$demo"; expect_rest_code "REST bad rule" 400 collections.rule-invalid
emit_rest "$f" "POST /catalog/collections with the same rule: 400" POST /catalog/collections "$body"

# --- manual.md ------------------------------------------------------------------------------------
f="$out/api/manual.md"
begin "$f" "Manual collections" "A manual collection holds the products the merchant picks, in the order picked (D2302); setting them replaces the list. An automatic collection takes no hand-picked products."
Q_SET='mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id mode productCount } }'
input="{id:'$summer',productIds:['$p3','$p1','$p2']}"
gql "$Q_SET" "$(vars "$input")" "$owner" "$demo"; expect_ok set
assert_js set "b.data.setStoreCollectionProducts.productCount===3" "$work/b"
emit "$f" "setStoreCollectionProducts: p3, p1, p2" "$Q_SET" "$(vars "$input")" "$owner" "$demo"
members "$summer" "$owner" "$demo"
assert_js order "b.data.storeCollectionProducts.items.map((p)=>p.productId).join()==='$p3,$p1,$p2'" "$work/b"
emit "$f" "storeCollectionProducts: in the order set" "$Q_MEMBERS" "$(vars "{id:'$summer',options:$MEMBERS_PAGE}")" "$owner" "$demo"
body=$(vars "{productIds:['$p1','$p3','$p2']}")
rest PUT "/catalog/collections/$summer/products" "$body" "$owner" "$demo"; expect_status "PUT products" 200
emit_rest "$f" "PUT /catalog/collections/:id/products: reordered p1, p3, p2" PUT "/catalog/collections/$summer/products" "$body"
rest GET "/catalog/collections/$summer/products" - "$owner" "$demo"; expect_status "GET products" 200
assert_js reorder "b.items.map((p)=>p.productId).join()==='$p1,$p3,$p2'" "$work/b"
emit_rest "$f" "GET /catalog/collections/:id/products: the new order" GET "/catalog/collections/$summer/products" -
input="{id:'$auto_all_id',productIds:['$p2']}"
gql "$Q_SET" "$(vars "$input")" "$owner" "$demo"; expect_code "not manual" collections.not-manual
emit "$f" "setStoreCollectionProducts on an automatic collection: refused" "$Q_SET" "$(vars "$input")" "$owner" "$demo"
body=$(vars "{productIds:['$p2']}")
rest PUT "/catalog/collections/$auto_all_id/products" "$body" "$owner" "$demo"; expect_rest_code "REST not manual" 409 collections.not-manual
emit_rest "$f" "PUT /catalog/collections/<automatic>/products: 409" PUT "/catalog/collections/$auto_all_id/products" "$body"
input="{id:'$summer',productIds:['$p1','$b_product']}"
gql "$Q_SET" "$(vars "$input")" "$owner" "$demo"; expect_code "B product" collections.product-not-found
emit "$f" "setStoreCollectionProducts with business B's product: not found, nothing changes" "$Q_SET" "$(vars "$input")" "$owner" "$demo"
body=$(vars "{productIds:['$b_product']}")
rest PUT "/catalog/collections/$summer/products" "$body" "$owner" "$demo"; expect_rest_code "REST B product" 404 collections.product-not-found
emit_rest "$f" "PUT /catalog/collections/:id/products with B's product: 404" PUT "/catalog/collections/$summer/products" "$body"
members "$summer" "$owner" "$demo"
assert_js "order kept" "b.data.storeCollectionProducts.items.map((p)=>p.productId).join()==='$p1,$p3,$p2'" "$work/b"
filter_id=$summer filter_title='تخفيضات الصيف'
