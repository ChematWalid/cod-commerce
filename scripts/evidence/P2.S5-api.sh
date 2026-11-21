# shellcheck shell=bash
# The API part of scripts/evidence/P2.S5.sh, sourced by it after the sign-ins: every offers admin endpoint over REST and
# GraphQL, one transcript per case. Uses the driver's helpers and variables (owner, second_owner, no_offers_member, demo,
# second, out, work); sets product, quantity_offer, bxgy_offer, addon_offer and codes_offer for the screens.

Q_CREATE_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id variants { id price } } } }'
core_id() { js "String($1).replace(/^T_/,'')" "$work/b"; }
create_product() { # create_product <label> <session> <channel> <input-js> -> $work/b
  gql "$Q_CREATE_PRODUCT" "$(vars "{input:$4}")" "$2" "$3"
  expect_ok "create $1"
}
OFFER_FIELDS='id kind method title status version publishedAt pausedAt archivedAt codeCount usageCount config targets { role refType refId } performance { orders deliveredRevenue discountGiven }'
remember_offer() { remember_id "$1" "$2"; }
CODE_SEQ=0
remember_codes() { # remember_codes <prefix>: every code id of the code list in $work/b, as <prefix>_<n>
  local id n=0
  for id in $(js 'b.map((c)=>c.id).join(" ")' "$work/b"); do
    n=$((n + 1))
    [[ -n "${PLACEHOLDERS[$id]:-}" ]] && continue
    CODE_SEQ=$((CODE_SEQ + 1))
    remember_id "$1_$CODE_SEQ" "$id"
  done
  ((n > 0)) || fail "remember_codes $1: no code"
}
version_of() { # version_of <offer-id>: the offer's current version, read as A's owner
  rest GET "/offers/$1" - "$owner" "$demo"; expect_status "version of $1" 200
  js 'b.version' "$work/b"
}
offer_body() { vars "$1"; }

# --- catalog ------------------------------------------------------------------------------------
create_product main "$owner" "$demo" "{title:'منتج العروض للأدلة',status:'active',price:4900,sku:'EVOFFER'}"
product=$(core_id 'b.data.createCatalogProduct.product.id')
create_product addon "$owner" "$demo" "{title:'إضافة الأدلة',status:'active',price:1500,sku:'EVADDON'}"
addon_variant=$(core_id 'b.data.createCatalogProduct.product.variants[0].id')
TIERS="{priceMode:'percent',tiers:[{quantity:2,price:10,preselected:true,freeDelivery:false},{quantity:3,price:15,preselected:false,freeDelivery:true}]}"
BUY="[{role:'buy',refType:'product',refId:'$product'}]"

# --- app-types.md -------------------------------------------------------------------------------
f="$out/api/app-types.md"
begin "$f" "App types" "The cards of the create dialog (D2515): seven built-in types, each naming its kind and method. Needs \`offers.view\`."
rest GET /offers/app-types - "$owner" "$demo"; expect_status "app types" 200
assert_js "seven app types" "b.length===7 && b.some((t)=>t.id==='discount_codes'&&t.kind==='product_discount'&&t.method==='codes')" "$work/b"
emit_rest "$f" "GET /offers/app-types" GET /offers/app-types -
Q='query { offerAppTypes { id kind method goal recommended } }'
gql "$Q" '{}' "$owner" "$demo"; expect_ok "offerAppTypes"
assert_js "seven app types (graphql)" 'b.data.offerAppTypes.length===7' "$work/b"
emit "$f" "offerAppTypes" "$Q" '{}' "$owner" "$demo"

# --- create-quantity-draft.md -------------------------------------------------------------------
f="$out/api/create-quantity-draft.md"
begin "$f" "Create a quantity draft" "A new offer is a draft of the active store (store from the session, never the body); \`offers.create\`."
body=$(offer_body "{kind:'quantity',title:'عرض الكمية للأدلة',config:$TIERS,targets:$BUY}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create quantity" 201
assert_js "draft" "b.status==='draft' && b.publishedAt===null && b.targets[0].role==='buy'" "$work/b"
quantity_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_QUANTITY "$quantity_offer"
emit_rest "$f" "POST /offers (quantity, two tiers, on the 4,900 product)" POST /offers "$body"

# --- publish-invalid.md -------------------------------------------------------------------------
f="$out/api/publish-invalid.md"
begin "$f" "Publish refused" "A draft may be incomplete; publishing checks it (D2510) and names every problem. Here a quantity draft with no product."
body=$(offer_body "{kind:'quantity',title:'مسودة بلا منتج',config:$TIERS}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create incomplete" 201
incomplete=$(js 'b.id' "$work/b"); remember_offer OFFER_INCOMPLETE "$incomplete"
emit_rest "$f" "POST /offers (no target)" POST /offers "$body"
rest POST "/offers/$incomplete/publish" - "$owner" "$demo"; expect_rest_code "publish incomplete" 422 offers.publish-invalid
assert_js "problems" "Array.isArray(b.problems) && b.problems.length>0" "$work/b"
emit_rest "$f" "POST /offers/:id/publish: 422 with the problems" POST "/offers/$incomplete/publish" -
rest GET "/offers/$incomplete" - "$owner" "$demo"; expect_status "still draft" 200
assert_js "still draft" "b.status==='draft'" "$work/b"

# --- publish.md ---------------------------------------------------------------------------------
f="$out/api/publish.md"
begin "$f" "Publish" "A complete draft becomes \`active\` and gets \`publishedAt\`; \`offers.edit\`."
rest POST "/offers/$quantity_offer/publish" - "$owner" "$demo"; expect_status publish 200
assert_js published "b.status==='active' && typeof b.publishedAt==='string'" "$work/b"
emit_rest "$f" "POST /offers/:id/publish" POST "/offers/$quantity_offer/publish" -
body=$(offer_body "{kind:'free_delivery',title:'توصيل مجاني للأدلة',config:{threshold:{type:'none'}}}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create free delivery" 201
free_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_FREE_DELIVERY "$free_offer"
Q="mutation (\$id: String!) { publishOffer(id: \$id) { id kind status publishedAt } }"
gql "$Q" "$(vars "{id:'$free_offer'}")" "$owner" "$demo"; expect_ok publishOffer
assert_js "published (graphql)" "b.data.publishOffer.status==='active'" "$work/b"
emit "$f" "publishOffer (a free-delivery offer)" "$Q" "$(vars "{id:'$free_offer'}")" "$owner" "$demo"

# --- duplicate.md -------------------------------------------------------------------------------
f="$out/api/duplicate.md"
begin "$f" "Duplicate" "A copy is a new draft with the same configuration and targets (D2511); \`offers.create\`."
rest POST "/offers/$quantity_offer/duplicate" - "$owner" "$demo"; expect_status duplicate 201
assert_js copy "b.status==='draft' && b.id!=='$quantity_offer' && b.config.tiers.length===2" "$work/b"
dup_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_COPY "$dup_offer"
emit_rest "$f" "POST /offers/:id/duplicate" POST "/offers/$quantity_offer/duplicate" -

# --- the other kinds (for the lists and the screens) -----------------------------------------------
body=$(offer_body "{kind:'bxgy',title:'اشتر 2 واحصل على 1 للأدلة',config:{appliesTo:'targets',buyQuantity:2,getQuantity:1,getFrom:'same',gift:{mode:'free'},maxTimesPerOrder:null},targets:$BUY}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create bxgy" 201
bxgy_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_BXGY "$bxgy_offer"
body=$(offer_body "{kind:'addon',title:'إضافة بعد الطلب للأدلة',config:{condition:'any_order',price:{mode:'fixed',value:1200},maxPiecesPerOrder:3,placement:'thank_you'},targets:[{role:'addon',refType:'variant',refId:'$addon_variant'}]}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create addon" 201
addon_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_ADDON "$addon_offer"
body=$(offer_body "{kind:'product_discount',method:'codes',title:'رموز الخصم للأدلة',config:{appliesTo:'all',valueType:'percent',value:10,cap:null,showCountdown:false}}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create codes" 201
codes_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_CODES "$codes_offer"

# --- list-by-status-and-kind.md -----------------------------------------------------------------
f="$out/api/list-by-status-and-kind.md"
begin "$f" "List by status and kind" "A page of the active store's offers, newest first; the query string (REST) or \`options\` (GraphQL) filters it."
rest GET '/offers?status=active&kind=quantity' - "$owner" "$demo"; expect_status "list active quantity" 200
assert_js "active quantity" "b.totalItems===1 && b.items[0].id==='$quantity_offer'" "$work/b"
emit_rest "$f" "GET /offers?status=active&kind=quantity" GET '/offers?status=active&kind=quantity' -
Q="query (\$options: OfferListInput) { offers(options: \$options) { totalItems items { id kind method title status } } }"
gql "$Q" '{"options":{"status":"draft"}}' "$owner" "$demo"; expect_ok "offers drafts"
assert_js "drafts only" "b.data.offers.items.length>=5 && b.data.offers.items.every((o)=>o.status==='draft')" "$work/b"
emit "$f" "offers(options: { status: draft })" "$Q" '{"options":{"status":"draft"}}' "$owner" "$demo"

# --- list-by-product.md -------------------------------------------------------------------------
f="$out/api/list-by-product.md"
begin "$f" "List by product" "The offers bought on one product (the product editor's Offers block, D2524)."
rest GET "/offers?productId=$product" - "$owner" "$demo"; expect_status "list by product" 200
assert_js "on the product" "b.totalItems===3 && ['$quantity_offer','$dup_offer','$bxgy_offer'].every((id)=>b.items.some((o)=>o.id===id))" "$work/b"
emit_rest "$f" "GET /offers?productId=<the 4,900 product>" GET "/offers?productId=$product" -

# --- codes-add-and-generate.md ------------------------------------------------------------------
f="$out/api/codes-add-and-generate.md"
begin "$f" "Codes: add, generate, list, remove" "Codes are stored upper case and unique per store (D2406, D2512); \`offers.edit\` writes, \`offers.view\` reads."
body='{"codes":[{"code":"welcome10","usageLimit":50}]}'
rest POST "/offers/$codes_offer/codes" "$body" "$owner" "$demo"; expect_status "add code" 201
assert_js "upper case" "b.length===1 && b[0].code==='WELCOME10' && b[0].usageLimit===50" "$work/b"
remember_codes CODE
emit_rest "$f" "POST /offers/:id/codes (lower case in, upper case stored)" POST "/offers/$codes_offer/codes" "$body"
body='{"count":3,"prefix":"EV"}'
rest POST "/offers/$codes_offer/codes/generate" "$body" "$owner" "$demo"; expect_status "generate" 201
assert_js "generated" "b.length===3 && b.every((c)=>/^EV[A-Z0-9]+$/.test(c.code))" "$work/b"
remember_codes CODE
removed=$(js 'b[2].code' "$work/b")
emit_rest "$f" "POST /offers/:id/codes/generate (three, prefix EV)" POST "/offers/$codes_offer/codes/generate" "$body"
Q="mutation (\$offerId: String!, \$input: GenerateOfferCodesInput!) { generateOfferCodes(offerId: \$offerId, input: \$input) { id code usageLimit usageCount } }"
V=$(vars "{offerId:'$codes_offer',input:{count:2,prefix:'GQ',usageLimit:1}}")
gql "$Q" "$V" "$owner" "$demo"; expect_ok generateOfferCodes
assert_js "generated (graphql)" "b.data.generateOfferCodes.length===2 && b.data.generateOfferCodes.every((c)=>c.code.startsWith('GQ'))" "$work/b"
node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));fs.writeFileSync(process.argv[2],JSON.stringify(b.data.generateOfferCodes))' "$work/b" "$work/codes.json"
command cp "$work/b" "$work/b.keep"; command cp "$work/codes.json" "$work/b"; remember_codes CODE; command cp "$work/b.keep" "$work/b"
emit "$f" "generateOfferCodes (two, prefix GQ, usage limit 1)" "$Q" "$V" "$owner" "$demo"
rest DELETE "/offers/$codes_offer/codes/$removed" - "$owner" "$demo"; expect_status "remove code" 200
assert_js removed "b.success===true" "$work/b"
emit_rest "$f" "DELETE /offers/:id/codes/:code (one generated code)" DELETE "/offers/$codes_offer/codes/$removed" -
rest GET "/offers/$codes_offer/codes" - "$owner" "$demo"; expect_status "list codes" 200
assert_js "five codes" "b.length===5 && !b.some((c)=>c.code==='$removed')" "$work/b"
emit_rest "$f" "GET /offers/:id/codes (oldest first)" GET "/offers/$codes_offer/codes" -

# --- codes-same-in-two-businesses.md ------------------------------------------------------------
f="$out/api/codes-same-in-two-businesses.md"
begin "$f" "The same code in two businesses" "\`SAME10\` is unique per store, not across businesses (D2528): A and B both hold it, and each lists only its own row."
body='{"codes":[{"code":"SAME10"}]}'
rest POST "/offers/$codes_offer/codes" "$body" "$owner" "$demo"; expect_status "A adds SAME10" 201
remember_codes CODE_A
emit_rest "$f" "Business A: POST /offers/:id/codes SAME10" POST "/offers/$codes_offer/codes" "$body"
b_body=$(offer_body "{kind:'product_discount',method:'codes',title:'Codes de B',config:{appliesTo:'all',valueType:'percent',value:15,cap:null,showCountdown:false}}")
rest POST /offers "$b_body" "$second_owner" "$second"; expect_status "B creates codes offer" 201
b_offer=$(js 'b.id' "$work/b"); remember_offer OFFER_B_CODES "$b_offer"
emit_rest "$f" "Business B: POST /offers (its own code offer)" POST /offers "$b_body"
rest POST "/offers/$b_offer/codes" "$body" "$second_owner" "$second"; expect_status "B adds SAME10" 201
assert_js "B holds SAME10" "b[0].code==='SAME10' && b[0].offerId==='$b_offer'" "$work/b"
remember_codes CODE_B
emit_rest "$f" "Business B: POST /offers/:id/codes SAME10 (201: A's row does not collide)" POST "/offers/$b_offer/codes" "$body"
rest POST "/offers/$codes_offer/codes" "$body" "$owner" "$demo"; expect_rest_code "A adds SAME10 twice" 409 offers.code-taken
emit_rest "$f" "Business A again: SAME10 is taken in its own store (409)" POST "/offers/$codes_offer/codes" "$body"
rest GET "/offers/$codes_offer/codes" - "$owner" "$demo"; expect_status "A codes" 200
assert_js "A sees its own SAME10" "b.filter((c)=>c.code==='SAME10').length===1 && b.every((c)=>c.offerId==='$codes_offer')" "$work/b"
emit_rest "$f" "Business A: GET /offers/:id/codes" GET "/offers/$codes_offer/codes" -
rest GET "/offers/$b_offer/codes" - "$second_owner" "$second"; expect_status "B codes" 200
assert_js "B sees one row" "b.length===1 && b[0].offerId==='$b_offer'" "$work/b"
emit_rest "$f" "Business B: GET /offers/:id/codes" GET "/offers/$b_offer/codes" -

# --- get-with-code-count.md ---------------------------------------------------------------------
f="$out/api/get-with-code-count.md"
begin "$f" "One offer with its code count" "One offer of the active store, with \`codeCount\` and its performance; \`offers.view\`."
rest GET "/offers/$codes_offer" - "$owner" "$demo"; expect_status get 200
assert_js "code count" "b.codeCount===6 && b.method==='codes'" "$work/b"
emit_rest "$f" "GET /offers/:id" GET "/offers/$codes_offer" -
Q="query (\$id: String!) { offer(id: \$id) { $OFFER_FIELDS } }"
gql "$Q" "$(vars "{id:'$codes_offer'}")" "$owner" "$demo"; expect_ok offer
assert_js "code count (graphql)" 'b.data.offer.codeCount===6' "$work/b"
emit "$f" "offer(id:)" "$Q" "$(vars "{id:'$codes_offer'}")" "$owner" "$demo"

# --- update-version-conflict.md -----------------------------------------------------------------
f="$out/api/update-version-conflict.md"
begin "$f" "Edit with a version" "An edit may name the version it was read at (D2535); an older version is refused, so two editors never overwrite each other."
read_at=$(version_of "$quantity_offer")
body=$(offer_body "{title:'عرض الكمية للأدلة',config:$TIERS,version:$read_at}")
rest PATCH "/offers/$quantity_offer" "$body" "$owner" "$demo"; expect_status "update at version" 200
assert_js "version moved on" "b.version===$((read_at + 1))" "$work/b"
emit_rest "$f" "PATCH /offers/:id at the current version $read_at" PATCH "/offers/$quantity_offer" "$body"
body=$(offer_body "{title:'عنوان قديم',version:$read_at}")
rest PATCH "/offers/$quantity_offer" "$body" "$owner" "$demo"; expect_rest_code "stale version" 409 offers.offer-conflict
emit_rest "$f" "PATCH /offers/:id at the old version $read_at: 409" PATCH "/offers/$quantity_offer" "$body"

# --- pause-resume-archive.md --------------------------------------------------------------------
f="$out/api/pause-resume-archive.md"
begin "$f" "Pause, resume, archive" "The lifecycle of a published offer (D2510); \`offers.edit\`."
rest POST "/offers/$free_offer/pause" - "$owner" "$demo"; expect_status pause 200
assert_js paused "b.status==='paused' && typeof b.pausedAt==='string'" "$work/b"
emit_rest "$f" "POST /offers/:id/pause" POST "/offers/$free_offer/pause" -
rest POST "/offers/$free_offer/resume" - "$owner" "$demo"; expect_status resume 200
assert_js resumed "b.status==='active'" "$work/b"
emit_rest "$f" "POST /offers/:id/resume" POST "/offers/$free_offer/resume" -
rest POST "/offers/$free_offer/archive" - "$owner" "$demo"; expect_status archive 200
assert_js archived "b.status==='archived' && typeof b.archivedAt==='string'" "$work/b"
emit_rest "$f" "POST /offers/:id/archive" POST "/offers/$free_offer/archive" -
rest POST "/offers/$free_offer/resume" - "$owner" "$demo"; expect_rest_code "resume archived" 409 offers.invalid-transition
emit_rest "$f" "POST /offers/:id/resume of an archived offer: 409" POST "/offers/$free_offer/resume" -

# --- edit-archived-refused.md -------------------------------------------------------------------
f="$out/api/edit-archived-refused.md"
begin "$f" "An archived offer is read only" "Archived is final: edits are refused."
body=$(offer_body "{title:'تعديل بعد الأرشفة'}")
rest PATCH "/offers/$free_offer" "$body" "$owner" "$demo"; expect_rest_code "edit archived" 409 offers.invalid-transition
emit_rest "$f" "PATCH /offers/:id of an archived offer" PATCH "/offers/$free_offer" "$body"
Q="mutation (\$id: String!, \$input: UpdateOfferInput!) { updateOffer(id: \$id, input: \$input) { id status } }"
V=$(vars "{id:'$free_offer',input:{title:'تعديل بعد الأرشفة'}}")
gql "$Q" "$V" "$owner" "$demo"; expect_code "edit archived (graphql)" offers.invalid-transition
emit "$f" "updateOffer of an archived offer" "$Q" "$V" "$owner" "$demo"

# --- delete-published-refused.md ----------------------------------------------------------------
f="$out/api/delete-published-refused.md"
begin "$f" "Only drafts delete" "A published offer is archived, never deleted (D2521); a draft deletes. \`offers.delete\`."
rest DELETE "/offers/$quantity_offer" - "$owner" "$demo"; expect_rest_code "delete published" 409 offers.offer-not-deletable
emit_rest "$f" "DELETE /offers/:id of an active offer: 409" DELETE "/offers/$quantity_offer" -
body=$(offer_body "{kind:'order_discount',title:'مسودة للحذف',config:{valueType:'percent',value:10,cap:null,minimum:{type:'none'}}}")
rest POST /offers "$body" "$owner" "$demo"; expect_status "create doomed" 201
doomed=$(js 'b.id' "$work/b"); remember_offer OFFER_DELETED "$doomed"
rest DELETE "/offers/$doomed" - "$owner" "$demo"; expect_status "delete draft" 200
assert_js deleted "b.success===true" "$work/b"
emit_rest "$f" "DELETE /offers/:id of a draft" DELETE "/offers/$doomed" -
rest GET "/offers/$doomed" - "$owner" "$demo"; expect_rest_code "deleted gone" 404 offers.offer-not-found
emit_rest "$f" "GET /offers/:id of the deleted draft: 404" GET "/offers/$doomed" -

# --- stats-zero.md ------------------------------------------------------------------------------
f="$out/api/stats-zero.md"
begin "$f" "Performance before any order" "Orders, delivered revenue and discount given (D2514); zeros until an order uses the offer."
rest GET "/offers/$quantity_offer/stats" - "$owner" "$demo"; expect_status stats 200
assert_js zeros "b.orders===0 && b.deliveredRevenue===0 && b.discountGiven===0" "$work/b"
emit_rest "$f" "GET /offers/:id/stats" GET "/offers/$quantity_offer/stats" -
Q="query (\$id: String!) { offerStats(id: \$id) { orders deliveredRevenue discountGiven } }"
gql "$Q" "$(vars "{id:'$quantity_offer'}")" "$owner" "$demo"; expect_ok offerStats
assert_js "zeros (graphql)" 'b.data.offerStats.orders===0' "$work/b"
emit "$f" "offerStats" "$Q" "$(vars "{id:'$quantity_offer'}")" "$owner" "$demo"

# --- previews -----------------------------------------------------------------------------------
preview_case() { # preview_case <file> <title> <intro> <offer-js> <assertion> -> REST transcript of POST /offers/preview
  begin "$1" "$2" "$3"
  local body; body=$(offer_body "{offer:$4,samplePrice:4900}")
  rest POST /offers/preview "$body" "$owner" "$demo"; expect_status "$2" 200
  assert_js "$2" "$5" "$work/b"
  emit_rest "$1" "POST /offers/preview" POST /offers/preview "$body"
}
QUANTITY_PREVIEW="{kind:'quantity',title:'معاينة',config:{priceMode:'percent',tiers:[{quantity:2,price:10},{quantity:3,price:15,freeDelivery:true}]},targets:$BUY}"
preview_case "$out/api/preview-quantity.md" "Preview a quantity draft" \
  "An unsaved offer priced on sample carts at 4,900 with 800 delivery, never stored (D2516, D2534): one cart per tier, plus 1 piece." \
  "$QUANTITY_PREVIEW" \
  "b.scenarios.map((s)=>s.pieces+':'+s.quote.total).join()==='1:5700,2:9620,3:12495' && b.scenarios[0].quote.nudge.saving===980 && b.warnings.length===0"
Q='query ($input: OfferPreviewInput!) { previewOffer(input: $input) { warnings scenarios { pieces addonAccepted quote } } }'
V=$(vars "{input:{offer:$QUANTITY_PREVIEW,samplePrice:4900}}")
gql "$Q" "$V" "$owner" "$demo"; expect_ok previewOffer
assert_js "preview (graphql)" "b.data.previewOffer.scenarios.map((s)=>s.quote.total).join()==='5700,9620,12495'" "$work/b"
emit "$out/api/preview-quantity.md" "previewOffer" "$Q" "$V" "$owner" "$demo"
rest GET "/offers?take=50" - "$owner" "$demo"; expect_status "nothing stored" 200
assert_js "nothing stored" "!b.items.some((o)=>o.title==='معاينة')" "$work/b"

preview_case "$out/api/preview-bxgy.md" "Preview buy 2 get 1" \
  "Three pieces: two paid at 4,900 and a gift line at 0 (D2504)." \
  "{kind:'bxgy',title:'معاينة',config:{appliesTo:'targets',buyQuantity:2,getQuantity:1,getFrom:'same',gift:{mode:'free'}},targets:$BUY}" \
  "b.scenarios.length===1 && b.scenarios[0].pieces===3 && b.scenarios[0].quote.lines.some((l)=>l.giftOf&&l.unitPrice===0&&l.totalPrice===0&&l.quantity===1) && b.scenarios[0].quote.total===10600"

preview_case "$out/api/preview-addon.md" "Preview an add-on" \
  "The add-on accepted on a one-piece order: 4,900 + 1,200 + 800 delivery." \
  "{kind:'addon',title:'معاينة',config:{condition:'any_order',price:{mode:'fixed',value:1200},maxPiecesPerOrder:3,placement:'thank_you'},targets:[{role:'addon',refType:'variant',refId:'$addon_variant'}]}" \
  "b.scenarios[0].addonAccepted===true && b.scenarios[0].quote.lines.some((l)=>l.addonOf&&l.unitPrice===1200) && b.scenarios[0].quote.total===6900"

preview_case "$out/api/preview-warning-total-mode.md" "Preview warning: a total that does not divide" \
  "A total-price tier of 10,000 DZD for 3 pieces cannot be a whole unit price; the preview warns and still prices it." \
  "{kind:'quantity',title:'معاينة',config:{priceMode:'total',tiers:[{quantity:3,price:10000}]},targets:$BUY}" \
  "b.warnings.join()==='tier_total_not_divisible' && b.scenarios.map((s)=>s.pieces).join()==='1,3'"

# --- isolation-b-offer-from-a.md ----------------------------------------------------------------
rest GET "/offers/$b_offer" - "$second_owner" "$second"; expect_status "B version" 200
b_version=$(js 'b.version' "$work/b")
f="$out/api/isolation-b-offer-from-a.md"
begin "$f" "Business A on business B's offer" "A's owner on its own store names B's offer id: not found everywhere, and nothing of B's changes."
rest GET "/offers/$b_offer" - "$owner" "$demo"; expect_rest_code "A reads B" 404 offers.offer-not-found
emit_rest "$f" "GET /offers/<B's offer>" GET "/offers/$b_offer" -
body=$(offer_body "{title:'Pris par A'}")
rest PATCH "/offers/$b_offer" "$body" "$owner" "$demo"; expect_rest_code "A edits B" 404 offers.offer-not-found
emit_rest "$f" "PATCH /offers/<B's offer>" PATCH "/offers/$b_offer" "$body"
rest GET "/offers/$b_offer/codes" - "$owner" "$demo"; expect_rest_code "A lists B's codes" 404 offers.offer-not-found
emit_rest "$f" "GET /offers/<B's offer>/codes" GET "/offers/$b_offer/codes" -
Q='query ($id: String!) { offer(id: $id) { id title } }'
gql "$Q" "$(vars "{id:'$b_offer'}")" "$owner" "$demo"; expect_ok "A offer(B)"
assert_js "null" 'b.data.offer===null' "$work/b"
emit "$f" "offer(id: <B's offer>)" "$Q" "$(vars "{id:'$b_offer'}")" "$owner" "$demo"
rest GET "/offers/$b_offer" - "$second_owner" "$second"; expect_status "B unchanged" 200
assert_js "B unchanged" "b.title==='Codes de B' && b.version===$b_version" "$work/b"
emit_rest "$f" "Business B reads its offer afterwards: unchanged" GET "/offers/$b_offer" -

# --- forbidden-without-offers-view.md -----------------------------------------------------------
f="$out/api/forbidden-without-offers-view.md"
begin "$f" "A member without offers.view" "The seed's orders clerk of the Demo business holds \`orders.view\` only (D2517): every offers endpoint refuses it."
rest GET /offers - "$no_offers_member" "$demo"; expect_status "member list" 403
emit_rest "$f" "GET /offers" GET /offers -
rest POST /offers/preview "$(offer_body "{offer:$QUANTITY_PREVIEW}")" "$no_offers_member" "$demo"; expect_status "member preview" 403
emit_rest "$f" "POST /offers/preview" POST /offers/preview "$(offer_body "{offer:$QUANTITY_PREVIEW}")"
Q='query { offers { totalItems } }'
gql "$Q" '{}' "$no_offers_member" "$demo"; expect_code "member offers" FORBIDDEN
emit "$f" "offers" "$Q" '{}' "$no_offers_member" "$demo"
