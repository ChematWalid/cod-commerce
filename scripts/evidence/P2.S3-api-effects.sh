# shellcheck shell=bash
# The second API part of scripts/evidence/P2.S3.sh, sourced after P2.S3-api.sh: product-collections.md, recompute.md,
# product-search.md, options.md, isolation.md and preview.md (last: it spends the administrator's preview budget). Uses
# the helpers, products, tags and collections of the first part; sets all_count and any_count for the screens.

# --- product-collections.md -----------------------------------------------------------------------
f="$out/api/product-collections.md"
begin "$f" "A product's collections" "The product editor's collections block (D2324a): the manual collections a product was put in by hand, and the automatic ones its facts match (read-only). Setting a product's collections replaces its manual links only (D2309)."
Q_OF_PRODUCT='query ($productId: ID!) { storeProductCollections(productId: $productId) { manual { id title } automatic { id title } } }'
Q_SET_OF_PRODUCT='mutation ($productId: ID!, $collectionIds: [ID!]!) { setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id title } automatic { id title } } }'
gql "$Q_OF_PRODUCT" "$(vars "{productId:'$p1'}")" "$owner" "$demo"; expect_ok "of p1"
assert_js "p1 manual" "b.data.storeProductCollections.manual.map((c)=>c.id).join()==='$summer'" "$work/b"
assert_js "p1 automatic" "['$auto_all_id','$auto_any_id','$red_id'].every((id)=>b.data.storeProductCollections.automatic.some((c)=>c.id===id))" "$work/b"
emit "$f" "storeProductCollections of p1: manual and added by rule" "$Q_OF_PRODUCT" "$(vars "{productId:'$p1'}")" "$owner" "$demo"
rest GET "/catalog/collections/of-product/$p1" - "$owner" "$demo"; expect_status "GET of-product" 200
emit_rest "$f" "GET /catalog/collections/of-product/:productId" GET "/catalog/collections/of-product/$p1" -
input="{productId:'$p4',collectionIds:['$summer']}"
gql "$Q_SET_OF_PRODUCT" "$(vars "$input")" "$owner" "$demo"; expect_ok "set of p4"
assert_js "p4 manual" "b.data.setStoreProductCollections.manual.map((c)=>c.id).join()==='$summer'" "$work/b"
emit "$f" "setStoreProductCollections: p4 into the summer collection" "$Q_SET_OF_PRODUCT" "$(vars "$input")" "$owner" "$demo"
body='{"collectionIds":[]}'
rest PUT "/catalog/collections/of-product/$p4" "$body" "$owner" "$demo"; expect_status "PUT of-product" 200
assert_js "p4 out" "b.manual.length===0&&b.automatic.some((c)=>c.id==='$auto_any_id')" "$work/b"
emit_rest "$f" "PUT /catalog/collections/of-product/:productId with none: the manual link goes, the rule's stay" PUT "/catalog/collections/of-product/$p4" "$body"
input="{productId:'$p4',collectionIds:['$b_collection']}"
gql "$Q_SET_OF_PRODUCT" "$(vars "$input")" "$owner" "$demo"; expect_code "B collection" collections.not-found
emit "$f" "setStoreProductCollections with business B's collection: not found" "$Q_SET_OF_PRODUCT" "$(vars "$input")" "$owner" "$demo"
Q_OPTIONS='query { catalogCollectionOptions { id title } }'
gql "$Q_OPTIONS" '{}' "$owner" "$demo"; expect_ok "catalog options"
assert_js "catalog options" "b.data.catalogCollectionOptions.some((c)=>c.id==='$summer')&&!b.data.catalogCollectionOptions.some((c)=>c.id==='$b_collection')" "$work/b"
emit "$f" "catalogCollectionOptions: the collections catalog's product list filters by" "$Q_OPTIONS" '{}' "$owner" "$demo"

# --- recompute.md ---------------------------------------------------------------------------------
f="$out/api/recompute.md"
begin "$f" "Membership follows product changes" "Every product write publishes \`product.changed\`; the worker recomputes the store's automatic collections under the store lock (D2334). The reads after a change poll until the worker has caught up (at most ${RECOMPUTE_WAIT_SECONDS}s); the transcript shows the first read that holds."
create "new tag" "{title:'وصل حديثا',visible:true,position:6,mode:'automatic',rule:{version:1,match:'all',conditions:[{field:'tag',operator:'is_any_of',values:['$tag_new']}]}}" "$owner" "$demo"; new_id=$MADE
members "$new_id" "$owner" "$demo"
assert_js "new before" "b.data.storeCollectionProducts.totalItems===0" "$work/b"
emit "$f" "Before: Tag is any of [new] has no product" "$Q_MEMBERS" "$(vars "{id:'$new_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"
input="{id:'$p3',input:{tagIds:['$tag_new']}}"
gql "$Q_UPDATE_PRODUCT" "$(vars "$input")" "$owner" "$demo"; expect_ok "tag p3"
emit "$f" "updateCatalogProduct: p3 gets the new tag" "$Q_UPDATE_PRODUCT" "$(vars "$input")" "$owner" "$demo"
poll_members "$new_id" "ids.join()==='$p3'" "tag added"
emit "$f" "After: p3 is a member" "$Q_MEMBERS" "$(vars "{id:'$new_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"
rest GET "/catalog/collections/$new_id/products" - "$owner" "$demo"; expect_status "REST after tag" 200
emit_rest "$f" "GET /catalog/collections/:id/products: the same" GET "/catalog/collections/$new_id/products" -

create "cheap" "{title:'من 1000 إلى 2000',visible:true,position:7,mode:'automatic',rule:{version:1,match:'all',conditions:[{field:'price',operator:'between',min:1000,max:2000}]}}" "$owner" "$demo"; cheap_id=$MADE
poll_members "$cheap_id" "ids.includes('$p3')&&ids.includes('$p5')" "cheap before"
emit "$f" "Before: Price 1000-2000 holds p3 (1500) and p5 (1200)" "$Q_MEMBERS" "$(vars "{id:'$cheap_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"
body=$(vars "{variants:[{id:'$p3_variant',price:2500}]}")
rest PATCH "/catalog/products/$p3" "$body" "$owner" "$demo"; expect_status "raise p3" 200
emit_rest "$f" "PATCH /catalog/products/:id: p3's price raised to 2500" PATCH "/catalog/products/$p3" "$body"
poll_members "$cheap_id" "!ids.includes('$p3')&&ids.includes('$p5')" "price raised"
emit "$f" "After: p3 has left, p5 stays" "$Q_MEMBERS" "$(vars "{id:'$cheap_id',options:$MEMBERS_PAGE}")" "$owner" "$demo"
rest GET "/catalog/collections/$cheap_id/products" - "$owner" "$demo"; expect_status "REST after price" 200
emit_rest "$f" "GET /catalog/collections/:id/products: the same" GET "/catalog/collections/$cheap_id/products" -

# --- product-search.md ----------------------------------------------------------------------------
f="$out/api/product-search.md"
begin "$f" "Product search of the manual editor" "The Add products dialog searches the active store's products by title (D2321); it needs \`catalog.collections.edit\`. Business B holds a product whose title also contains جري."
Q_SEARCH='query ($options: StoreCollectionProductSearchInput) { storeCollectionProductSearch(options: $options) { totalItems items { productId title status price } } }'
input=$(vars "{options:{search:'$pick_search',take:20}}")
gql "$Q_SEARCH" "$input" "$owner" "$demo"; expect_ok search
assert_js search "['$p1','$p2','$p4'].every((id)=>b.data.storeCollectionProductSearch.items.some((p)=>p.productId===id))&&!b.data.storeCollectionProductSearch.items.some((p)=>p.productId==='$b_product')" "$work/b"
emit "$f" "storeCollectionProductSearch (جري) in A's store: p1, p2, p4, never B's product" "$Q_SEARCH" "$input" "$owner" "$demo"
rest GET "/catalog/collections/product-search?search=$(urlencode "$pick_search")&take=20" - "$owner" "$demo"; expect_status "REST search" 200
assert_js "REST search" "['$p1','$p2','$p4'].every((id)=>b.items.some((p)=>p.productId===id))&&!b.items.some((p)=>p.productId==='$b_product')" "$work/b"
emit_rest "$f" "GET /catalog/collections/product-search?search=جري (URL-encoded)" GET "/catalog/collections/product-search?search=$(urlencode "$pick_search")&take=20" -
gql "$Q_SEARCH" "$input" "$second_owner" "$second"; expect_ok "B search"
assert_js "B search" "b.data.storeCollectionProductSearch.items.map((p)=>p.productId).join()==='$b_product'" "$work/b"
emit "$f" "The same search in business B's store: B's product only" "$Q_SEARCH" "$input" "$second_owner" "$second"

# --- options.md -----------------------------------------------------------------------------------
f="$out/api/options.md"
begin "$f" "Rule builder options" "The brands, tags and option names with values a condition can name, read from the active store only (D2321)."
Q_RULE_OPTIONS='query { storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }'
gql "$Q_RULE_OPTIONS" '{}' "$owner" "$demo"; expect_ok "A options"
assert_js "A options" "['$tag_promo','$tag_new'].every((id)=>b.data.storeCollectionRuleOptions.tags.some((t)=>t.id===id))&&!b.data.storeCollectionRuleOptions.tags.some((t)=>t.id==='$tag_b')&&b.data.storeCollectionRuleOptions.options.some((o)=>o.name==='$COLOR'&&o.values.includes('$RED'))" "$work/b"
emit "$f" "storeCollectionRuleOptions in A's store" "$Q_RULE_OPTIONS" '{}' "$owner" "$demo"
rest GET /catalog/collections/rule-options - "$second_owner" "$second"; expect_status "B options" 200
assert_js "B options" "b.tags.some((t)=>t.id==='$tag_b')&&!b.tags.some((t)=>['$tag_promo','$tag_new'].includes(t.id))&&!b.brands.some((x)=>x.id==='$brand_id')" "$work/b"
emit_rest "$f" "GET /catalog/collections/rule-options in B's store: B's tag, none of A's" GET /catalog/collections/rule-options -

# --- isolation.md ---------------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Business A against business B's collections" "A foreign or malformed id answers exactly like an unknown one; another business's channel token is refused outright; a merchant holds no grant on Vendure's stock collection API (D2101); store collections live in their store channel only, never the default channel (D2333)."
gql "$Q_COLLECTION" "$(vars "{id:'$b_collection'}")" "$owner" "$demo"; expect_ok "A reads B"
assert_js "A reads B" "b.data.storeCollection===null" "$work/b"
emit "$f" "storeCollection with B's collection id, A's session on A's store: null" "$Q_COLLECTION" "$(vars "{id:'$b_collection'}")" "$owner" "$demo"
rest GET "/catalog/collections/$b_collection" - "$owner" "$demo"; expect_rest_code "A REST reads B" 404 collections.not-found
emit_rest "$f" "GET /catalog/collections/<B's collection>: 404" GET "/catalog/collections/$b_collection" -
rest GET /catalog/collections/abc - "$owner" "$demo"; expect_rest_code "malformed" 404 collections.not-found
emit_rest "$f" "GET /catalog/collections/abc (malformed): the same 404" GET /catalog/collections/abc -
input="{id:'$b_collection',input:{title:'x'}}"
gql "$Q_UPDATE" "$(vars "$input")" "$owner" "$demo"; expect_code "A edits B" collections.not-found
emit "$f" "updateStoreCollection of B's collection: not found" "$Q_UPDATE" "$(vars "$input")" "$owner" "$demo"
gql "$Q_SET" "$(vars "{id:'$b_collection',productIds:['$p1']}")" "$owner" "$demo"; expect_code "A fills B" collections.not-found
emit "$f" "setStoreCollectionProducts on B's collection: not found" "$Q_SET" "$(vars "{id:'$b_collection',productIds:['$p1']}")" "$owner" "$demo"
rest DELETE "/catalog/collections/$b_collection" - "$owner" "$demo"; expect_rest_code "A deletes B" 404 collections.not-found
emit_rest "$f" "DELETE /catalog/collections/<B's collection>: 404" DELETE "/catalog/collections/$b_collection" -
rest GET "/catalog/collections/of-product/$b_product" - "$owner" "$demo"; expect_rest_code "A reads B product" 404 collections.product-not-found
emit_rest "$f" "GET /catalog/collections/of-product/<B's product>: 404" GET "/catalog/collections/of-product/$b_product" -
gql "$Q_COLLECTION" "$(vars "{id:'$b_collection'}")" "$second_owner" "$second"; expect_ok "B still has it"
assert_js "B still has it" "b.data.storeCollection.title==='Collection B'" "$work/b"
emit "$f" "B reads its collection: unchanged by A's attempts" "$Q_COLLECTION" "$(vars "{id:'$b_collection'}")" "$second_owner" "$second"
gql "$Q_COLLECTIONS" '{}' "$owner" "$second"; expect_code "A on B's channel" FORBIDDEN
emit "$f" "storeCollections, A's session with B's channel token: FORBIDDEN" "$Q_COLLECTIONS" '{}' "$owner" "$second"
rest GET /catalog/collections - "$owner" "$second"; expect_status "A REST on B's channel" 403
emit_rest "$f" "GET /catalog/collections, A's session with B's channel token: 403" GET /catalog/collections -
Q_STOCK='query { collections { totalItems items { id name } } }'
gql "$Q_STOCK" '{}' "$owner" "$demo"; expect_code "stock collections" FORBIDDEN
emit "$f" "Vendure's stock collections query as the merchant: FORBIDDEN" "$Q_STOCK" '{}' "$owner" "$demo"
gql "$Q_STOCK" '{}' "$superadmin" -; expect_ok "default channel"
assert_js "default channel" "!b.data.collections.items.some((c)=>['$summer','$auto_all_id','$auto_any_id','$not_promo_id','$red_id','$new_id','$cheap_id','$b_collection'].includes(String(c.id)))" "$work/b"
emit "$f" "The stock collections query on the default channel (platform account, no channel token): none of the store collections" "$Q_STOCK" '{}' "$superadmin" -

# --- preview.md -----------------------------------------------------------------------------------
f="$out/api/preview.md"
begin "$f" "Live preview of an unsaved rule" "The editor previews a rule while it is edited (AC4, D2331): a count and a page of matches, nothing saved. Each preview reads the whole store, so an administrator gets a per-minute budget (D2338)."
Q_PREVIEW='query ($input: StoreCollectionPreviewInput!) { previewStoreCollectionMatches(input: $input) { totalItems items { productId title price } } }'
gql "$Q_COLLECTIONS" '{"options":{"take":1}}' "$owner" "$demo"; expect_ok "count before"
saved_before=$(js 'b.data.storeCollections.totalItems' "$work/b")
input=$(vars "{input:{rule:$all_rule,take:10}}")
gql "$Q_PREVIEW" "$input" "$owner" "$demo"; expect_ok "preview all"
all_count=$(js 'b.data.previewStoreCollectionMatches.totalItems' "$work/b")
assert_js "preview all" "b.data.previewStoreCollectionMatches.items.map((p)=>p.productId).join()==='$p1'" "$work/b"
emit "$f" "previewStoreCollectionMatches: the All rule of AC1" "$Q_PREVIEW" "$input" "$owner" "$demo"
input=$(vars "{input:{rule:$any_rule,skip:0,take:2}}")
gql "$Q_PREVIEW" "$input" "$owner" "$demo"; expect_ok "preview any"
any_count=$(js 'b.data.previewStoreCollectionMatches.totalItems' "$work/b")
first_page=$(js "b.data.previewStoreCollectionMatches.items.map((p)=>p.productId).join()" "$work/b")
assert_js "preview any" "b.data.previewStoreCollectionMatches.items.length===2&&$any_count>$all_count" "$work/b"
emit "$f" "The same conditions with Any, first page of two" "$Q_PREVIEW" "$input" "$owner" "$demo"
input=$(vars "{input:{rule:$any_rule,skip:2,take:2}}")
gql "$Q_PREVIEW" "$input" "$owner" "$demo"; expect_ok "preview page 2"
assert_js "preview page 2" "b.data.previewStoreCollectionMatches.totalItems===$any_count&&b.data.previewStoreCollectionMatches.items.length===2&&!b.data.previewStoreCollectionMatches.items.some((p)=>'$first_page'.split(',').includes(p.productId))" "$work/b"
emit "$f" "Second page of two" "$Q_PREVIEW" "$input" "$owner" "$demo"
body=$(vars "{rule:$any_rule,take:5}")
rest POST /catalog/collections/preview "$body" "$owner" "$demo"; expect_status "REST preview" 200
assert_js "REST preview" "b.totalItems===$any_count" "$work/b"
emit_rest "$f" "POST /catalog/collections/preview" POST /catalog/collections/preview "$body"
rest GET '/catalog/collections?take=1' - "$owner" "$demo"; expect_status "count after" 200
assert_js "nothing saved" "b.totalItems===$saved_before" "$work/b"
emit_rest "$f" "GET /catalog/collections after the previews: still $saved_before collections, nothing saved" GET '/catalog/collections?take=1' -
input=$(vars "{input:{rule:$all_rule,take:1}}")
for ((try = 1; try <= COLLECTIONS_PREVIEW_BUDGET + 10; try++)); do
  gql "$Q_PREVIEW" "$input" "$owner" "$demo"
  [[ "$(js "(b.errors||[]).some((e)=>e.extensions&&e.extensions.code==='collections.rate-limited')" "$work/b")" == true ]] && break
done
expect_code "budget spent" collections.rate-limited
emit "$f" "previewStoreCollectionMatches past the budget (preview $try in a minute): refused with retryAfterSeconds" "$Q_PREVIEW" "$input" "$owner" "$demo"
body=$(vars "{rule:$all_rule,take:1}")
# The bucket refills a token every two seconds, so a call can still find one: spend it until the refusal comes.
for ((try = 1; try <= 10; try++)); do
  rest POST /catalog/collections/preview "$body" "$owner" "$demo"
  [[ "$status" == 429 ]] && break
done
expect_rest_code "REST budget spent" 429 collections.rate-limited
command grep -qi '^retry-after:' "$work/h" || fail "the 429 has no Retry-After"
emit_rest "$f" "POST /catalog/collections/preview past the budget: 429 with Retry-After" POST /catalog/collections/preview "$body"
