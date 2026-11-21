# shellcheck shell=bash
# The API part of scripts/evidence/P2.S2.sh, sourced by it after the sign-ins: packs, bulk edit, export, spreadsheet import
# (with the presigned PUT to the real Garage), link import and polish, the refusals and the cross-business cells. Uses the
# driver's helpers and variables (owner, second_owner, demo, second, demo_store, second_store, out, work); sets pack_id and
# screen_update_sku for the screens. Copied from P2.S1-api.sh.

XLSX_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
CSV_TYPE='text/csv'
JOB_WAIT_SECONDS=300
JOB_IMPORT_MAX_ATTEMPTS=4

# --- helpers -------------------------------------------------------------------------------------
remember_business() { # remember_business <session> <channel> <name>
  gql 'query { activeBusiness { id } }' '{}' "$1" "$2"; expect_ok "business of $3"
  remember_id "$3" "$(js 'b.data.activeBusiness.id' "$work/b")"
}
put_object() { # put_object <url> <file> <content-type> -> $status, $work/h, $work/b: a presigned PUT, the file as its body
  status=$(curl -sS -X PUT -D "$work/h" -o "$work/b" --max-time 60 -H "Content-Type: $3" --data-binary "@$2" \
    -w '%{http_code}' "$1") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from the object store"
}
emit_put() { # emit_put <file> <title> <url> <content-type> <body-file> <description>
  SHOWN_HEADERS=$(printf '%s\n' "Content-Type: $4" "Content-Length: $(command stat -c %s "$5")") SHOWN_BODY=$6 \
    TITLE=$2 METHOD=PUT URL=$3 node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
get_object() { # get_object <url> -> $status, $work/h, $work/b: a presigned GET
  status=$(curl -sS -X GET -D "$work/h" -o "$work/b" --max-time 60 -w '%{http_code}' "$1") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from the object store"
}
emit_get() { # emit_get <file> <title> <url>
  SHOWN_HEADERS='' SHOWN_BODY=- TITLE=$2 METHOD=GET URL=$3 node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
csv_file() { # csv_file <file> <row>...: one CSV line per argument, CRLF, UTF-8
  local file=$1; shift
  printf '%s\r\n' "$@" >"$file"
}
size_of() { command stat -c %s "$1"; }

Q_CREATE_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id sku price type } } }'
Q_PRODUCT='query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }'
new_product() { # new_product <session> <channel> <input-js> -> $NEW_ID
  gql "$Q_CREATE_PRODUCT" "$(vars "{input:$3}")" "$1" "$2"; expect_ok "create product $3"
  NEW_ID=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
}

IMPORT_FIELDS='importId status format rowCount progress headerRow columns { column header field warning } summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl'
PREVIEW_FIELDS='importId totalItems skip take items { rowNumber action productKey name messages } summary { creates updates errors warnings }'
EXPORT_FIELDS='exportId status progress rowCount skippedPacks errorCode downloadUrl'
Q_UPLOAD='mutation ($input: CatalogImportUploadInput!) { createCatalogImportUpload(input: $input) { importId uploadUrl method headers { name value } expiresAt } }'
Q_ANALYZE="mutation (\$input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: \$input) { $IMPORT_FIELDS } }"
Q_PREVIEW="mutation (\$id: String!, \$input: CatalogImportPreviewInput) { previewCatalogImport(id: \$id, input: \$input) { $PREVIEW_FIELDS } }"
Q_PREVIEW_PAGE="query (\$id: String!, \$skip: Int, \$take: Int) { catalogImportPreview(id: \$id, skip: \$skip, take: \$take) { $PREVIEW_FIELDS } }"
Q_CONFIRM="mutation (\$id: String!) { confirmCatalogImport(id: \$id) { $IMPORT_FIELDS } }"
Q_IMPORT="query (\$id: String!) { catalogImport(id: \$id) { $IMPORT_FIELDS } }"
Q_EXPORT="mutation (\$input: CatalogExportInput!) { exportCatalogProducts(input: \$input) { $EXPORT_FIELDS } }"
Q_EXPORT_JOB="query (\$id: String!) { catalogExport(id: \$id) { $EXPORT_FIELDS } }"

upload_json() { # upload_json <format> <file>: the REST body of an upload of <file>
  local type=$CSV_TYPE
  [[ "$1" == xlsx ]] && type=$XLSX_TYPE
  vars "{format:'$1',size:$(size_of "$2"),contentType:'$type'}"
}
rest_upload() { # rest_upload <session> <channel> <format> <file> -> $IMPORT_ID $UPLOAD_URL (the bytes not sent yet)
  rest POST /catalog/import-export/uploads "$(upload_json "$3" "$4")" "$1" "$2"; expect_status "upload $4" 200
  IMPORT_ID=$(js 'b.importId' "$work/b"); UPLOAD_URL=$(js 'b.uploadUrl' "$work/b")
}
send_file() { # send_file <format> <file>: PUTs <file> to $UPLOAD_URL with the format's own content type
  local type=$CSV_TYPE
  [[ "$1" == xlsx ]] && type=$XLSX_TYPE
  put_object "$UPLOAD_URL" "$2" "$type"; expect_status "PUT $2" 200
}
rest_analyze() { rest POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")" "$1" "$2"; }
wait_import() { # wait_import <session> <channel> <id>: until done or failed, -> $work/b holds the job
  local deadline=$((SECONDS + JOB_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    rest GET "/catalog/import-export/products/imports/$3" - "$1" "$2"; expect_status "import $3" 200
    [[ "$(js 'b.status' "$work/b")" =~ ^(done|failed)$ ]] && return 0
    sleep 1
  done
  fail "import $3 not settled after ${JOB_WAIT_SECONDS}s"
}
wait_export() { # wait_export <session> <channel> <id>: until done or failed, -> $work/b holds the job
  local deadline=$((SECONDS + JOB_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    rest GET "/catalog/import-export/exports/$3" - "$1" "$2"; expect_status "export $3" 200
    [[ "$(js 'b.status' "$work/b")" =~ ^(done|failed)$ ]] && return 0
    sleep 1
  done
  fail "export $3 not settled after ${JOB_WAIT_SECONDS}s"
}
import_quietly() { # import_quietly <session> <channel> <csv>: upload → analyze → preview → confirm → settled, nothing written to $out
  rest_upload "$1" "$2" csv "$3"; send_file csv "$3"
  rest_analyze "$1" "$2"; expect_status "analyze $3" 200
  rest POST "/catalog/import-export/products/imports/$IMPORT_ID/preview" '{}' "$1" "$2"; expect_status "preview $3" 200
  rest POST "/catalog/import-export/products/imports/$IMPORT_ID/confirm" - "$1" "$2"; expect_status "confirm $3" 200
  wait_import "$1" "$2" "$IMPORT_ID"
}

remember_business "$owner" "$demo" BUSINESS_DEMO
remember_business "$second_owner" "$second" BUSINESS_SECOND

# --- taxonomy the transcripts use ------------------------------------------------------------------
gql 'mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id } }' "$(vars "{input:{name:'علامة الحزم'}}")" "$owner" "$demo"
expect_ok "brand"; brand_id=$(js 'b.data.createCatalogBrand.id' "$work/b"); remember_id BRAND_DEMO "$brand_id"
gql 'mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id } }' "$(vars "{input:{name:'تخفيضات'}}")" "$owner" "$demo"
expect_ok "tag"; tag_id=$(js 'b.data.createCatalogTag.id' "$work/b"); remember_id TAG_DEMO "$tag_id"
gql 'mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id } }' "$(vars "{input:{name:'Marque B'}}")" "$second_owner" "$second"
expect_ok "brand of B"; b_brand=$(js 'b.data.createCatalogBrand.id' "$work/b"); remember_id BRAND_OF_B "$b_brand"

# --- packs.md -------------------------------------------------------------------------------------
f="$out/api/packs.md"
begin "$f" "Packs" "A Pack product groups other products of its store (D2202): priced as the sum of its components with a discount, or at a fixed price; weighed as their sum or fixed. Reads need \`catalog.products.view\`, writes and the preview \`catalog.products.edit\`. The stored price of the pack product follows each save."
PACK_FIELDS='productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams'
Q_PACK="query (\$productId: ID!) { catalogPack(productId: \$productId) { $PACK_FIELDS } }"
Q_SAVE_PACK="mutation (\$productId: ID!, \$input: CatalogPackInput!) { saveCatalogPack(productId: \$productId, input: \$input) { $PACK_FIELDS } }"
Q_PREVIEW_PACK='mutation ($input: CatalogPackInput!) { previewCatalogPack(input: $input) { price weightGrams sharedValues { value price } } }'
new_product "$owner" "$demo" "{title:'قميص الحزمة',status:'active',price:1500,sku:'EVPACK-SHIRT',weight:300}"; shirt_id=$NEW_ID
new_product "$owner" "$demo" "{title:'قبعة الحزمة',status:'active',price:2000,sku:'EVPACK-CAP',weight:200}"; cap_id=$NEW_ID
input=$(vars "{input:{title:'حزمة القميص والقبعة',status:'active',type:'pack',price:0,sku:'EVPACK'}}")
gql "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"; expect_ok "pack product"
pack_id=$(js 'b.data.createCatalogProduct.product.id' "$work/b")
assert_js "pack type" "b.data.createCatalogProduct.product.type==='pack'" "$work/b"
emit "$f" "createCatalogProduct with type pack (catalog, D2201)" "$Q_CREATE_PRODUCT" "$input" "$owner" "$demo"
pack_input="{packPricingMode:'components_sum',packDiscountType:'percent',packDiscountValue:10,packVariantMode:'per_component',packWeightMode:'components_sum',components:[{productId:'$shirt_id',quantity:1},{productId:'$cap_id',quantity:1}]}"
input=$(vars "{input:$pack_input}")
gql "$Q_PREVIEW_PACK" "$input" "$owner" "$demo"; expect_ok "pack preview"
assert_js "pack preview" "b.data.previewCatalogPack.price===3150&&b.data.previewCatalogPack.weightGrams===500" "$work/b"
emit "$f" "previewCatalogPack: (1 500 + 2 000) × 90 % = 3 150 DZD, 300 + 200 g; nothing saved" "$Q_PREVIEW_PACK" "$input" "$owner" "$demo"
input=$(vars "{productId:'$pack_id',input:$pack_input}")
gql "$Q_SAVE_PACK" "$input" "$owner" "$demo"; expect_ok "save pack"
assert_js "save pack" "b.data.saveCatalogPack.price===3150&&b.data.saveCatalogPack.components.length===2" "$work/b"
emit "$f" "saveCatalogPack: the pack's components, discount and modes" "$Q_SAVE_PACK" "$input" "$owner" "$demo"
gql "$Q_PACK" "$(vars "{productId:'$pack_id'}")" "$owner" "$demo"; expect_ok "pack"
assert_js "pack" "b.data.catalogPack.packDiscountValue===10" "$work/b"
emit "$f" "catalogPack" "$Q_PACK" "$(vars "{productId:'$pack_id'}")" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'$pack_id'}")" "$owner" "$demo"; expect_ok "pack price"
assert_js "pack price" "b.data.catalogProduct.price===3150" "$work/b"
emit "$f" "catalogProduct of the pack: its stored price is the pack's" "$Q_PRODUCT" "$(vars "{id:'$pack_id'}")" "$owner" "$demo"
rest GET "/catalog/packs/$pack_id" - "$owner" "$demo"; expect_status "GET pack" 200
emit_rest "$f" "GET /catalog/packs/:productId" GET "/catalog/packs/$pack_id" -
body=$(vars "{packPricingMode:'fixed',packFixedPrice:2999,packVariantMode:'per_component',packWeightMode:'fixed',packFixedWeightGrams:450,components:[{productId:'$shirt_id',quantity:2},{productId:'$cap_id',quantity:1}]}")
rest POST /catalog/packs/preview "$body" "$owner" "$demo"; expect_status "REST preview" 200
assert_js "REST preview" "b.price===2999&&b.weightGrams===450" "$work/b"
emit_rest "$f" "POST /catalog/packs/preview: a fixed price and weight" POST /catalog/packs/preview "$body"
rest PUT "/catalog/packs/$pack_id" "$body" "$owner" "$demo"; expect_status "PUT pack" 200
assert_js "PUT pack" "b.price===2999&&b.packPricingMode==='fixed'" "$work/b"
emit_rest "$f" "PUT /catalog/packs/:productId: the fixed pack" PUT "/catalog/packs/$pack_id" "$body"
input=$(vars "{productId:'$pack_id',input:$pack_input}")
gql "$Q_SAVE_PACK" "$input" "$owner" "$demo"; expect_ok "pack back to 10 %"
assert_js "pack back" "b.data.saveCatalogPack.price===3150" "$work/b"
emit "$f" "saveCatalogPack: back to 10 % off the components (the pack the screens show)" "$Q_SAVE_PACK" "$input" "$owner" "$demo"
input=$(vars "{productId:'$shirt_id',input:$pack_input}")
gql "$Q_SAVE_PACK" "$input" "$owner" "$demo"; expect_code "not a pack" packs.not-a-pack
emit "$f" "saveCatalogPack on a physical product: refused" "$Q_SAVE_PACK" "$input" "$owner" "$demo"
body=$(vars "{packPricingMode:'components_sum',packVariantMode:'per_component',packWeightMode:'components_sum',components:[{productId:'$pack_id',quantity:1},{productId:'$cap_id',quantity:1}]}")
rest POST /catalog/packs/preview "$body" "$owner" "$demo"; expect_status "pack in pack" 400
assert_js "pack in pack" "b.code==='packs.component-is-pack'" "$work/b"
emit_rest "$f" "POST /catalog/packs/preview with a pack as a component: refused" POST /catalog/packs/preview "$body"

# --- bulk-edit.md ---------------------------------------------------------------------------------
f="$out/api/bulk-edit.md"
begin "$f" "Bulk edit" "Status, brand, tags and price of up to 500 selected products of the active store (D2213); one result per product. \`dryRun\` computes the same results and writes nothing. Needs \`catalog.products.edit\`."
Q_BULK='mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { results { productId ok changedFields error } } }'
bulk_ids=()
for n in 1 2 3; do
  new_product "$owner" "$demo" "{title:'منتج التعديل الجماعي $n',status:'active',price:${n}000,sku:'EVBULK-$n'}"
  bulk_ids+=("$NEW_ID")
done
ids_js="['${bulk_ids[0]}','${bulk_ids[1]}','${bulk_ids[2]}']"
input=$(vars "{input:{productIds:$ids_js,changes:{status:'draft',price:{mode:'percent',value:10}},dryRun:true}}")
gql "$Q_BULK" "$input" "$owner" "$demo"; expect_ok "dry run"
assert_js "dry run" "b.data.bulkEditCatalogProducts.results.every((r)=>r.ok&&r.changedFields.includes('status')&&r.changedFields.includes('price'))" "$work/b"
emit "$f" "bulkEditCatalogProducts, dry run: Draft and +10 %" "$Q_BULK" "$input" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'${bulk_ids[0]}'}")" "$owner" "$demo"; expect_ok "after dry run"
assert_js "after dry run" "b.data.catalogProduct.status==='active'&&b.data.catalogProduct.price===1000" "$work/b"
emit "$f" "catalogProduct after the dry run: unchanged" "$Q_PRODUCT" "$(vars "{id:'${bulk_ids[0]}'}")" "$owner" "$demo"
input=$(vars "{input:{productIds:$ids_js,changes:{status:'draft',brandId:'$brand_id',addTagIds:['$tag_id'],price:{mode:'percent',value:10}}}}")
gql "$Q_BULK" "$input" "$owner" "$demo"; expect_ok "bulk apply"
assert_js "bulk apply" "b.data.bulkEditCatalogProducts.results.every((r)=>r.ok)" "$work/b"
emit "$f" "bulkEditCatalogProducts: Draft, a brand, a tag and +10 %" "$Q_BULK" "$input" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'${bulk_ids[1]}'}")" "$owner" "$demo"; expect_ok "after apply"
assert_js "after apply" "b.data.catalogProduct.status==='draft'&&b.data.catalogProduct.price===2200&&b.data.catalogProduct.brandId==='$brand_id'&&b.data.catalogProduct.tagIds.includes('$tag_id')" "$work/b"
emit "$f" "catalogProduct after the edit: Draft, 2 200 DZD, the brand and the tag" "$Q_PRODUCT" "$(vars "{id:'${bulk_ids[1]}'}")" "$owner" "$demo"
body=$(vars "{productIds:['${bulk_ids[0]}','999999'],changes:{status:'active',price:{mode:'amount',value:-100}}}")
rest POST /catalog/products/bulk-edit "$body" "$owner" "$demo"; expect_status "partial" 200
assert_js "partial" "b.results.find((r)=>r.productId==='${bulk_ids[0]}').ok===true&&b.results.find((r)=>r.productId==='999999').error==='catalog.product-not-found'" "$work/b"
emit_rest "$f" "POST /catalog/products/bulk-edit: one product of the store and one unknown id (a partial failure)" POST /catalog/products/bulk-edit "$body"
body=$(vars "{productIds:['${bulk_ids[2]}'],changes:{brandId:'$b_brand'}}")
rest POST /catalog/products/bulk-edit "$body" "$owner" "$demo"; expect_rest_code "foreign brand" 404 catalog-import.taxonomy-not-found
emit_rest "$f" "POST /catalog/products/bulk-edit with business B's brand: refused, nothing written" POST /catalog/products/bulk-edit "$body"
gql "$Q_PRODUCT" "$(vars "{id:'${bulk_ids[2]}'}")" "$owner" "$demo"; expect_ok "after refusal"
assert_js "after refusal" "b.data.catalogProduct.brandId==='$brand_id'" "$work/b"

# --- export.md ------------------------------------------------------------------------------------
f="$out/api/export.md"
begin "$f" "Export" "Selected products (at most 500) or every product the list's filter finds (D2211). Up to 500 rows the file is written at once and answered with a 5-minute download link; above, a job on the \`imports-exports\` queue writes it and \`catalogExport\` is read until it is done. Pack products are skipped and counted (D2220). Needs \`catalog.products.view\`."
Q_FIELDS='query { catalogImportFields { key required } }'
Q_FORMATS='query { catalogImportFormats { format contentType extension } }'
gql "$Q_FIELDS" '{}' "$owner" "$demo"; expect_ok fields
assert_js fields "b.data.catalogImportFields[0].key==='product_key'" "$work/b"
emit "$f" "catalogImportFields: the spreadsheet columns, in file order (D2209)" "$Q_FIELDS" '{}' "$owner" "$demo"
gql "$Q_FORMATS" '{}' "$owner" "$demo"; expect_ok formats
emit "$f" "catalogImportFormats" "$Q_FORMATS" '{}' "$owner" "$demo"
rest GET /catalog/import-export/fields - "$owner" "$demo"; expect_status "GET fields" 200
emit_rest "$f" "GET /catalog/import-export/fields" GET /catalog/import-export/fields -
rest GET /catalog/import-export/formats - "$owner" "$demo"; expect_status "GET formats" 200
emit_rest "$f" "GET /catalog/import-export/formats" GET /catalog/import-export/formats -
input=$(vars "{input:{scope:'selected',format:'csv',productIds:['${bulk_ids[0]}','${bulk_ids[1]}','$pack_id']}}")
gql "$Q_EXPORT" "$input" "$owner" "$demo"; expect_ok "export selected"
assert_js "export selected" "b.data.exportCatalogProducts.status==='done'&&b.data.exportCatalogProducts.rowCount===2&&b.data.exportCatalogProducts.skippedPacks===1" "$work/b"
remember_id EXPORT_SELECTED "$(js 'b.data.exportCatalogProducts.exportId' "$work/b")"
download=$(js 'b.data.exportCatalogProducts.downloadUrl' "$work/b")
emit "$f" "exportCatalogProducts: two products and the pack, CSV; written at once, the pack skipped" "$Q_EXPORT" "$input" "$owner" "$demo"
get_object "$download"; expect_status "download csv" 200
command grep -q 'EVBULK-1' "$work/b" || fail "the CSV holds no EVBULK-1 row"
emit_get "$f" "GET the download link: the CSV, as an attachment" "$download"
body=$(vars "{scope:'selected',format:'xlsx',productIds:['${bulk_ids[2]}']}")
rest POST /catalog/products/export "$body" "$owner" "$demo"; expect_status "REST export" 200
assert_js "REST export" "b.status==='done'&&b.rowCount===1" "$work/b"
remember_id EXPORT_REST "$(js 'b.exportId' "$work/b")"
download=$(js 'b.downloadUrl' "$work/b")
emit_rest "$f" "POST /catalog/products/export: one product, Excel" POST /catalog/products/export "$body"
get_object "$download"; expect_status "download xlsx" 200
emit_get "$f" "GET the download link: the Excel file" "$download"

job_csv="$work/job-products.csv"
{
  printf 'product_key,name,status,price,variant_sku\r\n'
  for ((n = 1; n <= JOB_EXPORT_PRODUCTS; n++)); do printf 'EVJOB-%s,منتج الدفعة %s,active,%s,EVJOB-%s\r\n' "$n" "$n" "$((1000 + n))" "$n"; done
} >"$job_csv"
# Under load the worker's database pool can run dry while a 520-row import competes with the pack recompute deliveries
# its product.changed events fan out (job failed, catalog-import.job-failed; issue #260). A
# rerun of the same file updates what the failed one created and creates the rest, so the store ends with every product.
job_import_attempts=0
until ((job_import_attempts >= JOB_IMPORT_MAX_ATTEMPTS)); do
  job_import_attempts=$((job_import_attempts + 1))
  import_quietly "$owner" "$demo" "$job_csv"
  remember_id "IMPORT_JOB_PRODUCTS_$job_import_attempts" "$IMPORT_ID"
  [[ "$(js 'b.status' "$work/b")" == done ]] && break
done
assert_js "job products" "b.status==='done'&&b.result.created+b.result.updated===$JOB_EXPORT_PRODUCTS&&b.result.failed===0" "$work/b"
input=$(vars "{input:{scope:'filtered',format:'xlsx',query:{q:'EVJOB'}}}")
gql "$Q_EXPORT" "$input" "$owner" "$demo"; expect_ok "export job"
assert_js "export job" "b.data.exportCatalogProducts.status==='queued'&&b.data.exportCatalogProducts.downloadUrl===null" "$work/b"
export_job=$(js 'b.data.exportCatalogProducts.exportId' "$work/b"); remember_id EXPORT_JOB "$export_job"
emit "$f" "exportCatalogProducts, filtered: the $JOB_EXPORT_PRODUCTS products imported for this (above 500), queued as a job" "$Q_EXPORT" "$input" "$owner" "$demo"
wait_export "$owner" "$demo" "$export_job"
assert_js "export job done" "b.status==='done'&&b.rowCount===$JOB_EXPORT_PRODUCTS" "$work/b"
gql "$Q_EXPORT_JOB" "$(vars "{id:'$export_job'}")" "$owner" "$demo"; expect_ok "catalogExport"
assert_js "catalogExport" "b.data.catalogExport.status==='done'&&b.data.catalogExport.progress===100" "$work/b"
emit "$f" "catalogExport: the job done, with a fresh download link" "$Q_EXPORT_JOB" "$(vars "{id:'$export_job'}")" "$owner" "$demo"
rest GET "/catalog/import-export/exports/$export_job" - "$owner" "$demo"; expect_status "GET export" 200
download=$(js 'b.downloadUrl' "$work/b")
emit_rest "$f" "GET /catalog/import-export/exports/:id" GET "/catalog/import-export/exports/$export_job" -
get_object "$download"; expect_status "download job" 200
emit_get "$f" "GET the download link: the job's Excel file" "$download"

# --- import.md ------------------------------------------------------------------------------------
f="$out/api/import.md"
begin "$f" "Spreadsheet import" "Upload → analyze → preview → confirm (D2210). The upload is a presigned PUT straight to the private bucket, its exact size and content type signed (D2208); the analysis reads the object's HEAD first. The preview plans each row (create, update or error, with message ids only); confirm writes exactly the planned rows in a job and keeps a CSV report of the failed ones. Every step needs \`catalog.products.create\`; an update row also \`catalog.products.edit\`."
new_product "$owner" "$demo" "{title:'منتج للتحديث',status:'active',price:1000,sku:'EVUPD-1'}"; update_id=$NEW_ID
showcase="$work/showcase.csv"
csv_file "$showcase" \
  'product_key,name,type,status,price,old_price,brand,tags,variant_sku,image_urls,Remarque libre' \
  'EVIMP-1,قميص مستورد,physical,active,2200,2600,علامة الحزم,تخفيضات,EVIMP-1,https://images.example.test/evimp-1.png,قطن ناعم' \
  'EVUPD-1,منتج للتحديث,physical,active,1200,,,,EVUPD-1,,سعر جديد' \
  'EVIMP-2,سعر غير صالح,physical,active,abc,,,,EVIMP-2,,' \
  'EVIMP-3,حزمة مستوردة,pack,active,3000,,,,EVIMP-3,,' \
  "id:999999,منتج غير موجود,physical,active,1500,,,,,,"
input=$(vars "{input:{format:'csv',size:$(size_of "$showcase"),contentType:'$CSV_TYPE'}}")
gql "$Q_UPLOAD" "$input" "$owner" "$demo"; expect_ok upload
IMPORT_ID=$(js 'b.data.createCatalogImportUpload.importId' "$work/b"); remember_id IMPORT_SHOWCASE "$IMPORT_ID"
showcase_id=$IMPORT_ID
UPLOAD_URL=$(js 'b.data.createCatalogImportUpload.uploadUrl' "$work/b")
assert_js "signed headers" "b.data.createCatalogImportUpload.headers.some((h)=>h.name==='content-length'&&h.value==='$(size_of "$showcase")')" "$work/b"
assert_js "upload key" "b.data.createCatalogImportUpload.uploadUrl.includes('/uploads/b/')&&b.data.createCatalogImportUpload.uploadUrl.includes('/s/$demo_store/imports/$IMPORT_ID/source')" "$work/b"
emit "$f" "createCatalogImportUpload: a 6-line CSV; the answer is a presigned PUT under uploads/b/<business>/s/<store>/" "$Q_UPLOAD" "$input" "$owner" "$demo"
send_file csv "$showcase"
emit_put "$f" "PUT the file to the upload link (Garage): stored" "$UPLOAD_URL" "$CSV_TYPE" "$showcase" "showcase.csv ($(size_of "$showcase") bytes: a header and five rows)"
input=$(vars "{input:{importId:'$IMPORT_ID'}}")
gql "$Q_ANALYZE" "$input" "$owner" "$demo"; expect_ok analyze
assert_js analyze "b.data.analyzeCatalogImport.status==='analyzed'&&b.data.analyzeCatalogImport.rowCount===5" "$work/b"
assert_js "ignored column" "b.data.analyzeCatalogImport.columns.find((c)=>c.header==='Remarque libre').field===null" "$work/b"
note_column=$(js "b.data.analyzeCatalogImport.columns.find((c)=>c.header==='Remarque libre').column" "$work/b")
emit "$f" "analyzeCatalogImport: header row, five rows, columns mapped by name (the unknown one ignored)" "$Q_ANALYZE" "$input" "$owner" "$demo"
input=$(vars "{id:'$IMPORT_ID',input:{mapping:[{column:$note_column,field:'description'}]}}")
gql "$Q_PREVIEW" "$input" "$owner" "$demo"; expect_ok preview
assert_js preview "b.data.previewCatalogImport.summary.creates===1&&b.data.previewCatalogImport.summary.updates===1&&b.data.previewCatalogImport.summary.errors===3" "$work/b"
assert_js "preview rows" "b.data.previewCatalogImport.items.map((r)=>r.action).join()==='create,update,error,error,error'" "$work/b"
emit "$f" "previewCatalogImport, the free-text column mapped to description: one create, one update, three errors" "$Q_PREVIEW" "$input" "$owner" "$demo"
input=$(vars "{id:'$IMPORT_ID',skip:2,take:2}")
gql "$Q_PREVIEW_PAGE" "$input" "$owner" "$demo"; expect_ok "preview page"
assert_js "preview page" "b.data.catalogImportPreview.items.length===2&&b.data.catalogImportPreview.items[0].rowNumber===4" "$work/b"
emit "$f" "catalogImportPreview: a page of the stored preview" "$Q_PREVIEW_PAGE" "$input" "$owner" "$demo"
rest GET "/catalog/import-export/products/imports/$IMPORT_ID/preview?skip=0&take=5" - "$owner" "$demo"; expect_status "GET preview" 200
emit_rest "$f" "GET /catalog/import-export/products/imports/:id/preview" GET "/catalog/import-export/products/imports/$IMPORT_ID/preview?skip=0&take=5" -
input=$(vars "{id:'$IMPORT_ID'}")
gql "$Q_CONFIRM" "$input" "$owner" "$demo"; expect_ok confirm
assert_js confirm "b.data.confirmCatalogImport.status==='confirming'" "$work/b"
emit "$f" "confirmCatalogImport: the job is queued" "$Q_CONFIRM" "$input" "$owner" "$demo"
wait_import "$owner" "$demo" "$IMPORT_ID"
gql "$Q_IMPORT" "$input" "$owner" "$demo"; expect_ok "import done"
assert_js "import done" "b.data.catalogImport.status==='done'&&JSON.stringify(b.data.catalogImport.result)===JSON.stringify({created:1,updated:1,failed:3})&&typeof b.data.catalogImport.errorReportUrl==='string'" "$work/b"
report=$(js 'b.data.catalogImport.errorReportUrl' "$work/b")
emit "$f" "catalogImport: done, one created, one updated, three failed, with the error report link" "$Q_IMPORT" "$input" "$owner" "$demo"
get_object "$report"; expect_status "error report" 200
command grep -q 'catalog-import.row-type-unsupported' "$work/b" || fail "the error report has no row-type-unsupported row"
emit_get "$f" "GET the error report link: the failed rows and their reasons (CSV)" "$report"
gql "$Q_PRODUCT" "$(vars "{id:'$update_id'}")" "$owner" "$demo"; expect_ok "updated product"
assert_js "updated product" "b.data.catalogProduct.price===1200" "$work/b"
emit "$f" "catalogProduct of EVUPD-1: the update row's price written" "$Q_PRODUCT" "$(vars "{id:'$update_id'}")" "$owner" "$demo"
gql 'query ($options: CatalogProductListInput) { catalogProducts(options: $options) { items { id title price brandId tagIds } } }' \
  "$(vars "{options:{q:'EVIMP-1'}}")" "$owner" "$demo"; expect_ok "created product"
assert_js "created product" "b.data.catalogProducts.items.length===1&&b.data.catalogProducts.items[0].price===2200&&b.data.catalogProducts.items[0].brandId==='$brand_id'" "$work/b"
emit "$f" "catalogProducts for EVIMP-1: created with its brand and tag matched by name" \
  'query ($options: CatalogProductListInput) { catalogProducts(options: $options) { items { id title price brandId tagIds } } }' \
  "$(vars "{options:{q:'EVIMP-1'}}")" "$owner" "$demo"

rest_csv="$work/rest.csv"
csv_file "$rest_csv" 'product_key,name,status,price,variant_sku' 'EVREST-1,منتج عبر REST,draft,1800,EVREST-1'
rest_upload "$owner" "$demo" csv "$rest_csv"; remember_id IMPORT_REST "$IMPORT_ID"
emit_rest "$f" "POST /catalog/import-export/uploads" POST /catalog/import-export/uploads "$(upload_json csv "$rest_csv")"
send_file csv "$rest_csv"
emit_put "$f" "PUT the file to the upload link" "$UPLOAD_URL" "$CSV_TYPE" "$rest_csv" "rest.csv ($(size_of "$rest_csv") bytes)"
rest_analyze "$owner" "$demo"; expect_status "REST analyze" 200
emit_rest "$f" "POST /catalog/import-export/products/analyze" POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")"
rest POST "/catalog/import-export/products/imports/$IMPORT_ID/preview" '{}' "$owner" "$demo"; expect_status "REST preview" 200
assert_js "REST preview" "b.summary.creates===1" "$work/b"
emit_rest "$f" "POST /catalog/import-export/products/imports/:id/preview (the detected mapping)" POST "/catalog/import-export/products/imports/$IMPORT_ID/preview" '{}'
rest POST "/catalog/import-export/products/imports/$IMPORT_ID/confirm" - "$owner" "$demo"; expect_status "REST confirm" 200
emit_rest "$f" "POST /catalog/import-export/products/imports/:id/confirm" POST "/catalog/import-export/products/imports/$IMPORT_ID/confirm" -
wait_import "$owner" "$demo" "$IMPORT_ID"
assert_js "REST import done" "b.status==='done'&&b.result.created===1&&b.errorReportUrl===null" "$work/b"
emit_rest "$f" "GET /catalog/import-export/products/imports/:id: done, nothing failed (no report)" GET "/catalog/import-export/products/imports/$IMPORT_ID" -

# --- import-refusals.md ---------------------------------------------------------------------------
f="$out/api/import-refusals.md"
begin "$f" "Import refusals" "What the object store and the import refuse (D2208, D2209, D2210, D2217). Refusals carry a stable code; the file's text is never echoed."
small="$work/small.csv" big="$work/big.csv"
csv_file "$small" 'product_key,name,price' 'EVSIGN-1,Signed size,1000'
csv_file "$big" 'product_key,name,price' 'EVSIGN-1,Signed size,1000' 'EVSIGN-2,One row more than signed,1000'
rest_upload "$owner" "$demo" csv "$small"; remember_id IMPORT_SIGNED "$IMPORT_ID"
emit_rest "$f" "POST /catalog/import-export/uploads: $(size_of "$small") bytes declared" POST /catalog/import-export/uploads "$(upload_json csv "$small")"
put_object "$UPLOAD_URL" "$big" "$CSV_TYPE"; expect_status "larger body" 403
emit_put "$f" "PUT a larger body than signed to the link: Garage refuses it (403)" "$UPLOAD_URL" "$CSV_TYPE" "$big" "big.csv ($(size_of "$big") bytes, $(size_of "$small") signed)"
rest_analyze "$owner" "$demo"; expect_rest_code "nothing stored" 409 catalog-import.job-state
emit_rest "$f" "POST …/analyze: nothing was stored, so there is nothing to analyze" POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")"

make_png() { node -e 'require("fs").writeFileSync(process.argv[1], Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108020000009077053e0000000c4944415408d763f8ffff3f0005fe02fea7d6a4b30000000049454e44ae426082","hex"))' "$1"; }
fake_csv="$work/photo.csv"; make_png "$fake_csv"
rest_upload "$owner" "$demo" csv "$fake_csv"; remember_id IMPORT_PNG "$IMPORT_ID"
send_file csv "$fake_csv"
rest_analyze "$owner" "$demo"; expect_rest_code "png as csv" 400 catalog-import.file-type
emit_rest "$f" "POST …/analyze of a PNG uploaded as CSV: file-type (the bytes are sniffed, the object deleted)" POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")"

rest_upload "$owner" "$demo" csv "$small"; remember_id IMPORT_MISMATCH "$IMPORT_ID"
mismatch_key=$(node -e 'const u=new URL(process.argv[1]); console.log(decodeURIComponent(u.pathname.split("/").slice(2).join("/")))' "$UPLOAD_URL")
[[ "$mismatch_key" == uploads/b/*/s/$demo_store/imports/$IMPORT_ID/source ]] || fail "unexpected upload key $mismatch_key"
# Garage refuses any other size on the link (above), so the mismatch is written with the bucket's own keys, as a client
# holding them could: the analysis must still refuse it from the object's HEAD.
S3_ENDPOINT=$S3_PUBLIC_ENDPOINT KEY=$mismatch_key BODY_FILE=$big node --input-type=module -e '
import { readFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
const env = process.env;
const client = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION || "garage", forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } });
await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET_PRIVATE, Key: env.KEY, Body: readFileSync(env.BODY_FILE), ContentType: "text/csv" }));' ||
  fail "writing the mismatched object"
rest_analyze "$owner" "$demo"; expect_rest_code "size mismatch" 413 catalog-import.file-too-large
emit_rest "$f" "POST …/analyze of an object of $(size_of "$big") bytes where $(size_of "$small") were declared: file-too-large" POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")"

many="$work/many.csv"
{
  printf 'product_key,name,price\r\n'
  for ((n = 1; n <= TOO_MANY_ROWS; n++)); do printf 'EVMANY-%s,Row %s,1000\r\n' "$n" "$n"; done
} >"$many"
rest_upload "$owner" "$demo" csv "$many"; remember_id IMPORT_MANY "$IMPORT_ID"
send_file csv "$many"
rest_analyze "$owner" "$demo"; expect_rest_code "too many rows" 400 catalog-import.too-many-rows
emit_rest "$f" "POST …/analyze of $TOO_MANY_ROWS rows: too-many-rows (at most 5 000)" POST /catalog/import-export/products/analyze "$(vars "{importId:'$IMPORT_ID'}")"

rest POST /catalog/import-export/uploads "$(vars "{format:'csv',size:100,contentType:'$XLSX_TYPE'}")" "$owner" "$demo"
expect_rest_code "type pair" 400 catalog-import.invalid-input
emit_rest "$f" "POST /catalog/import-export/uploads with a content type that is not the format's: invalid-input (D2225)" POST /catalog/import-export/uploads "$(vars "{format:'csv',size:100,contentType:'$XLSX_TYPE'}")"


rest POST "/catalog/import-export/products/imports/$showcase_id/confirm" - "$owner" "$demo"
expect_rest_code "second confirm" 409 catalog-import.job-state
emit_rest "$f" "POST …/confirm of the import already done: job-state (confirm runs once)" POST "/catalog/import-export/products/imports/$showcase_id/confirm" -

# A create-only member: the seeded first-store catalog role gains catalog.products.create (and still lacks edit).
gql 'query { businessRoles { id name permissions } }' '{}' "$owner" "$demo"; expect_ok roles
role_id=$(js "b.data.businessRoles.find((r)=>r.name==='Demo first store catalog').id" "$work/b")
gql 'mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id permissions } }' \
  "$(vars "{id:'$role_id',input:{grants:['catalog.products.create']}}")" "$owner" "$demo"; expect_ok "grant create"
assert_js "create only" "b.data.updateBusinessRole.permissions.includes('catalog.products.create')&&!b.data.updateBusinessRole.permissions.includes('catalog.products.edit')" "$work/b"
login perstore@demo.example.test; member=$LAST_TOKEN
member_csv="$work/member.csv"
csv_file "$member_csv" 'product_key,name,status,price,variant_sku' 'EVUPD-1,منتج للتحديث,active,9999,EVUPD-1' 'EVMEMBER-1,منتج العضو,draft,1500,EVMEMBER-1'
rest_upload "$member" "$demo" csv "$member_csv"; remember_id IMPORT_MEMBER "$IMPORT_ID"
send_file csv "$member_csv"
rest_analyze "$member" "$demo"; expect_status "member analyze" 200
rest POST "/catalog/import-export/products/imports/$IMPORT_ID/preview" '{}' "$member" "$demo"; expect_status "member preview" 200
assert_js "update forbidden" "b.items[0].action==='error'&&b.items[0].messages.includes('catalog-import.update-forbidden')&&b.items[1].action==='create'" "$work/b"
emit_rest "$f" "POST …/preview as a member holding create but not edit: the update row is an update-forbidden error, the new product a create" POST "/catalog/import-export/products/imports/$IMPORT_ID/preview" '{}'

# 429: business B's owner spends the actor budget of the import (30 an hour, D2217).
reset_limits
for ((n = 1; n <= 40; n++)); do
  rest POST /catalog/import-export/uploads "$(vars "{format:'csv',size:100,contentType:'$CSV_TYPE'}")" "$second_owner" "$second"
  [[ "$status" == 429 ]] && break
  expect_status "upload $n" 200
done
expect_status "budget" 429
command grep -qi '^retry-after: [1-9]' "$work/h" || fail "429 without Retry-After"
emit_rest "$f" "POST /catalog/import-export/uploads, call $n of business B's owner within the hour: 429 with Retry-After" POST /catalog/import-export/uploads "$(vars "{format:'csv',size:100,contentType:'$CSV_TYPE'}")"
reset_limits

# --- link-import.md -------------------------------------------------------------------------------
f="$out/api/link-import.md"
begin "$f" "Link import and polish" "A product page's link becomes a Draft product (D2214): title, description, price and image links read from the page, flagged for image review, no image fetched. This stack runs the fixture scraper (synthetic pages on \`shop.example.test\` only); the HTTP scraper's guard refuses private, loopback and internal hosts with the same code. Polish is the AI hook (D2215): identity until P9.S7b, nothing saved."
Q_LINK='mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { importId status sourceUrl productId } }'
Q_LINK_JOB='query ($id: String!) { catalogLinkImport(id: $id) { importId status sourceUrl productId } }'
Q_POLISH='mutation ($id: ID!) { polishCatalogProduct(id: $id) { productId title description } }'
input=$(vars "{input:{url:'https://shop.example.test/products/kaftan'}}")
gql "$Q_LINK" "$input" "$owner" "$demo"; expect_ok "link import"
link_id=$(js 'b.data.createCatalogLinkImport.importId' "$work/b"); remember_id LINK_IMPORT "$link_id"
link_product=$(js 'b.data.createCatalogLinkImport.productId' "$work/b")
emit "$f" "createCatalogLinkImport: a synthetic product page" "$Q_LINK" "$input" "$owner" "$demo"
gql "$Q_PRODUCT" "$(vars "{id:'$link_product'}")" "$owner" "$demo"; expect_ok "link product"
assert_js "link draft" "b.data.catalogProduct.status==='draft'" "$work/b"
emit "$f" "catalogProduct: the Draft the link made" "$Q_PRODUCT" "$(vars "{id:'$link_product'}")" "$owner" "$demo"
gql "$Q_LINK_JOB" "$(vars "{id:'$link_id'}")" "$owner" "$demo"; expect_ok "link job"
emit "$f" "catalogLinkImport" "$Q_LINK_JOB" "$(vars "{id:'$link_id'}")" "$owner" "$demo"
gql "$Q_POLISH" "$(vars "{id:'$link_product'}")" "$owner" "$demo"; expect_ok polish
assert_js polish "b.data.polishCatalogProduct.productId==='$link_product'" "$work/b"
emit "$f" "polishCatalogProduct: the text unchanged (identity hook)" "$Q_POLISH" "$(vars "{id:'$link_product'}")" "$owner" "$demo"
body=$(vars "{url:'https://shop.example.test/products/scarf'}")
rest POST /catalog/scrape/import-job "$body" "$owner" "$demo"; expect_status "REST link" 200
rest_link=$(js 'b.importId' "$work/b"); remember_id LINK_IMPORT_REST "$rest_link"; rest_link_product=$(js 'b.productId' "$work/b")
emit_rest "$f" "POST /catalog/scrape/import-job" POST /catalog/scrape/import-job "$body"
rest GET "/catalog/scrape/import-jobs/$rest_link" - "$owner" "$demo"; expect_status "REST link job" 200
emit_rest "$f" "GET /catalog/scrape/import-jobs/:id" GET "/catalog/scrape/import-jobs/$rest_link" -
rest POST "/catalog/scrape/products/$rest_link_product/polish" - "$owner" "$demo"; expect_status "REST polish" 200
emit_rest "$f" "POST /catalog/scrape/products/:id/polish" POST "/catalog/scrape/products/$rest_link_product/polish" -
for url in 'http://127.0.0.1/admin' 'http://10.0.0.5/product' 'https://unknown-shop.example.com/p/1'; do
  body=$(vars "{url:'$url'}")
  rest POST /catalog/scrape/import-job "$body" "$owner" "$demo"; expect_rest_code "refused $url" 400 catalog-import.link-refused
  emit_rest "$f" "POST /catalog/scrape/import-job with $url: link-refused" POST /catalog/scrape/import-job "$body"
done

# --- isolation.md ---------------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Business A against business B's packs, imports, exports and link imports" "A foreign id answers exactly like an unknown one (D2136, D2278); another business's channel token is refused outright."
new_product "$second_owner" "$second" "{title:'Produit B',status:'active',price:1500,sku:'EVB-1'}"; b_product=$NEW_ID
new_product "$second_owner" "$second" "{title:'Produit B 2',status:'active',price:900,sku:'EVB-3'}"; b_product2=$NEW_ID
new_product "$second_owner" "$second" "{title:'Pack B',status:'active',type:'pack',price:0}"; b_pack=$NEW_ID
gql "$Q_SAVE_PACK" "$(vars "{productId:'$b_pack',input:{packPricingMode:'components_sum',packVariantMode:'per_component',packWeightMode:'components_sum',components:[{productId:'$b_product',quantity:1},{productId:'$b_product2',quantity:1}]}}")" "$second_owner" "$second"
expect_ok "B pack"
b_csv="$work/b.csv"; csv_file "$b_csv" 'product_key,name,price' 'EVB-2,Produit B 2,1000'
rest_upload "$second_owner" "$second" csv "$b_csv"; send_file csv "$b_csv"; b_import=$IMPORT_ID; remember_id IMPORT_OF_B "$b_import"
rest_analyze "$second_owner" "$second"; expect_status "B analyze" 200
rest POST "/catalog/import-export/products/imports/$b_import/preview" '{}' "$second_owner" "$second"; expect_status "B preview" 200
rest POST /catalog/products/export "$(vars "{scope:'selected',format:'csv',productIds:['$b_product']}")" "$second_owner" "$second"
expect_status "B export" 200; b_export=$(js 'b.exportId' "$work/b"); remember_id EXPORT_OF_B "$b_export"
rest POST /catalog/scrape/import-job "$(vars "{url:'https://shop.example.test/products/kaftan'}")" "$second_owner" "$second"
expect_status "B link" 200; b_link=$(js 'b.importId' "$work/b"); remember_id LINK_OF_B "$b_link"

gql "$Q_PACK" "$(vars "{productId:'$b_pack'}")" "$owner" "$demo"; expect_ok "A reads B pack"
assert_js "A reads B pack" "b.data.catalogPack===null" "$work/b"
emit "$f" "catalogPack of B's pack, A's session on A's store: null" "$Q_PACK" "$(vars "{productId:'$b_pack'}")" "$owner" "$demo"
rest GET "/catalog/packs/$b_pack" - "$owner" "$demo"; expect_rest_code "A REST B pack" 404 packs.not-found
emit_rest "$f" "GET /catalog/packs/<B's pack>: 404" GET "/catalog/packs/$b_pack" -
body=$(vars "{packPricingMode:'fixed',packFixedPrice:1,packVariantMode:'per_component',packWeightMode:'components_sum',components:[{productId:'$cap_id',quantity:1},{productId:'$shirt_id',quantity:1}]}")
rest PUT "/catalog/packs/$b_pack" "$body" "$owner" "$demo"; expect_rest_code "A saves B pack" 404 packs.not-found
emit_rest "$f" "PUT /catalog/packs/<B's pack>: 404, B's pack unchanged" PUT "/catalog/packs/$b_pack" "$body"
input=$(vars "{input:{packPricingMode:'components_sum',packVariantMode:'per_component',packWeightMode:'components_sum',components:[{productId:'$b_product',quantity:1},{productId:'$cap_id',quantity:1}]}}")
gql "$Q_PREVIEW_PACK" "$input" "$owner" "$demo"; expect_code "B component" packs.component-not-found
emit "$f" "previewCatalogPack with B's product as a component: not found, no price" "$Q_PREVIEW_PACK" "$input" "$owner" "$demo"
for kind in import export link; do
  case $kind in
    import) q=$Q_IMPORT; id=$b_import; path="/catalog/import-export/products/imports/$b_import" ;;
    export) q=$Q_EXPORT_JOB; id=$b_export; path="/catalog/import-export/exports/$b_export" ;;
    link) q=$Q_LINK_JOB; id=$b_link; path="/catalog/scrape/import-jobs/$b_link" ;;
  esac
  gql "$q" "$(vars "{id:'$id'}")" "$owner" "$demo"; expect_code "A reads B $kind" catalog-import.job-not-found
  emit "$f" "B's $kind id read by A: job-not-found" "$q" "$(vars "{id:'$id'}")" "$owner" "$demo"
  rest GET "$path" - "$owner" "$demo"; expect_rest_code "A REST B $kind" 404 catalog-import.job-not-found
  shown="${path%/*}/<B's $kind>"
  emit_rest "$f" "GET $shown: 404" GET "$path" -
done
for step in preview confirm; do
  rest POST "/catalog/import-export/products/imports/$b_import/$step" - "$owner" "$demo"
  expect_rest_code "A $step B" 404 catalog-import.job-not-found
  emit_rest "$f" "POST /catalog/import-export/products/imports/<B's import>/$step: 404" POST "/catalog/import-export/products/imports/$b_import/$step" -
done
rest GET "/catalog/import-export/products/imports/$b_import" - "$second_owner" "$second"; expect_status "B import intact" 200
assert_js "B import intact" "b.status==='previewed'" "$work/b"
emit_rest "$f" "B reads its import: still previewed, A's confirm did nothing" GET "/catalog/import-export/products/imports/$b_import" -
body=$(vars "{productIds:['$b_product'],changes:{status:'draft'}}")
rest POST /catalog/products/bulk-edit "$body" "$owner" "$demo"; expect_status "A bulk B" 200
assert_js "A bulk B" "b.results[0].ok===false&&b.results[0].error==='catalog.product-not-found'" "$work/b"
emit_rest "$f" "POST /catalog/products/bulk-edit naming B's product: reported not found" POST /catalog/products/bulk-edit "$body"
body=$(vars "{scope:'selected',format:'csv',productIds:['$b_product']}")
rest POST /catalog/products/export "$body" "$owner" "$demo"; expect_status "A exports B" 200
assert_js "A exports B" "b.status==='done'&&b.rowCount===0" "$work/b"
remember_id EXPORT_A_OF_B "$(js 'b.exportId' "$work/b")"
emit_rest "$f" "POST /catalog/products/export of B's product id: an empty file" POST /catalog/products/export "$body"
rest POST "/catalog/scrape/products/$b_product/polish" - "$owner" "$demo"; expect_rest_code "A polishes B" 404 catalog.product-not-found
emit_rest "$f" "POST /catalog/scrape/products/<B's product>/polish: 404" POST "/catalog/scrape/products/$b_product/polish" -
gql "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$second_owner" "$second"; expect_ok "B product intact"
assert_js "B product intact" "b.data.catalogProduct.status==='active'" "$work/b"
emit "$f" "B reads its product: still active" "$Q_PRODUCT" "$(vars "{id:'$b_product'}")" "$second_owner" "$second"
gql "$Q_PACK" "$(vars "{productId:'$pack_id'}")" "$owner" "$second"; expect_code "A on B's channel" FORBIDDEN
emit "$f" "catalogPack, A's session with B's channel token: FORBIDDEN" "$Q_PACK" "$(vars "{productId:'$pack_id'}")" "$owner" "$second"
rest GET /catalog/import-export/fields - "$owner" "$second"; expect_status "A REST on B's channel" 403
emit_rest "$f" "GET /catalog/import-export/fields, A's session with B's channel token: 403" GET /catalog/import-export/fields -
gql "$Q_FIELDS" '{}' - "$demo"; expect_code anonymous FORBIDDEN
emit "$f" "catalogImportFields without a session: FORBIDDEN" "$Q_FIELDS" '{}' - "$demo"

# The screens' import updates this product of the store by its SKU.
screen_update_sku=EVUPD-1
