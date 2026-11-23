# shellcheck shell=bash
# The API part of scripts/evidence/P3.S1.sh, sourced by it after the sign-ins: the public and signed wilaya endpoints,
# every fee-group endpoint over REST and GraphQL, the store links (#230, #153) and the cross-business refusals, one
# transcript per case. Uses the driver's helpers and variables (owner, second_owner, demo, second, demo_store,
# second_store, out, work); sets pricing_group (the edited pricing option) for the screens.

PRICING_FIELDS='id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault'
GROUP_FIELDS="$PRICING_FIELDS rates { provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled deskEnabled overridden } communeRates { codeOns provinceCode homePrice deskPrice baseHomePrice deliveryEnabled deskEnabled overridden }"
ALGER=16 ALGER_CENTRE=1601 CASBAH=1607
# A body of every wilaya at one home price (and the seeded desk price 400): `group_body <name> <home> [<alger home>]`.
group_body() {
  N="$1" H="$2" A="${3:-$2}" node -e '
const codes = Array.from({ length: 69 }, (_, i) => String(i + 1).padStart(2, "0"));
const e = process.env;
const rates = codes.map((provinceCode) => ({
  provinceCode, homePrice: Number(provinceCode === "16" ? e.A : e.H), deskPrice: 400, deliveryEnabled: true, deskEnabled: true,
}));
console.log(JSON.stringify({ name: e.N, carrierId: null, chargeOverweight: true, overweightAllowanceKg: 5, overweightRate: 50, rates }));'
}
base_body() { # base_body <name> <alger home> <created group json>: every wilaya back at its base price, Alger at <alger home>
  N="$1" A="$2" node -e '
const e = process.env; const g = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const rates = g.rates.map((r) => ({ provinceCode: r.provinceCode, homePrice: r.provinceCode === "16" ? Number(e.A) : r.baseHomePrice,
  deskPrice: r.baseDeskPrice, deliveryEnabled: true, deskEnabled: true }));
console.log(JSON.stringify({ name: e.N, carrierId: null, chargeOverweight: true, overweightAllowanceKg: 5, overweightRate: 50, rates }));' "$3"
}
communes_body() { # communes_body: Alger-Centre home 777, Casbah delivery off (the narrowing shows it)
  echo "{\"rows\":[{\"codeOns\":$ALGER_CENTRE,\"homePrice\":777,\"deskPrice\":null,\"deliveryEnabled\":null,\"deskEnabled\":null},{\"codeOns\":$CASBAH,\"homePrice\":null,\"deskPrice\":null,\"deliveryEnabled\":false,\"deskEnabled\":null}]}"
}
shown_group() { # the shown request body: the first two of the 69 rates, then a note
  B="$1" node -e 'const b=JSON.parse(process.env.B); b.rates=[...b.rates.slice(0,2),"… 67 more wilayas, Alger (16) as listed in the text"]; console.log(JSON.stringify(b))'
}
cut_rates() { # keeps an answer short: the wilaya rows of Adrar, Chlef and Alger only (D3123: 69 rows in the real answer)
  node -e '
const fs = require("fs"); const f = process.argv[1]; const t = fs.readFileSync(f, "utf8");
let b; try { b = JSON.parse(t); } catch { process.exit(0); }
const cut = (g) => { if (g && Array.isArray(g.rates) && g.rates.length === 69) { g.rates = g.rates.filter((r) => ["01","02","16"].includes(r.provinceCode)); g.ratesShown = "3 of 69"; } };
cut(b); if (b.data) Object.values(b.data).forEach(cut);
fs.writeFileSync(f, JSON.stringify(b));' "$work/b"
}
cut_towns() { # keeps an answer short: Alger's first three communes and the narrowed one
  node -e '
const fs = require("fs"); const f = process.argv[1]; const b = JSON.parse(fs.readFileSync(f, "utf8"));
if (Array.isArray(b.towns)) { const n = b.towns.length; b.towns = b.towns.filter((t, i) => i < 3 || t.codeOns === 1607); b.townsShown = `${b.towns.length} of ${n}`; }
fs.writeFileSync(f, JSON.stringify(b));' "$work/b"
}

# Signs a GET to a guarded route with the store header `x-store-id` covered (D3135): sets SIGNED_ARGS and SIGNED_SHOWN.
signed_get_args() { # signed_get_args <path> <store-id>
  local lines line
  lines=$(printf '[{"method":"GET","path":"%s","storeId":"%s"}]' "$1" "$2" |
    (cd apps/server && timeout 120 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only ../../scripts/evidence/P1.S6-sign.ts internal) |
    node -e 'const h=JSON.parse(require("fs").readFileSync(0,"utf8"))[0]; for (const [k,v] of Object.entries(h)) console.log(k+": "+v)')
  SIGNED_ARGS=()
  while IFS= read -r line; do [[ -n "$line" ]] && SIGNED_ARGS+=(-H "$line"); done <<<"$lines"
  SIGNED_SHOWN=$'x-internal-kid: '"${INTERNAL_HMAC_ACTIVE_KID}"$'\nx-internal-ts: <unix seconds>\nx-internal-sig: [REDACTED]\nx-store-id: '"$2"
}
signed_get() { # signed_get <path> <signed-store-id> -> $status, $work/h, $work/b
  signed_get_args "$1" "$2"
  status=$(curl -sS -D "$work/h" -o "$work/b" --max-time 30 "${SIGNED_ARGS[@]}" -w '%{http_code}' "$api$1") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api$1"
}
emit_signed() { # emit_signed <file> <title> <path>
  SHOWN_HEADERS=$SIGNED_SHOWN SHOWN_BODY=- TITLE=$2 METHOD=GET URL="$api$3" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}

# --- provinces-list.md ----------------------------------------------------------------------------
reset_limits
f="$out/api/provinces-list.md"
begin "$f" "Wilayas (public)" "Reference data for anyone (D3117): no session, limited per client address, cached; 69 wilayas (D3123), no communes."
rest GET /provinces - - -; expect_status provinces 200
assert_js "69 wilayas" "b.length===69 && b[15].code==='16' && b[68].code==='69'" "$work/b"
command grep -qi '^cache-control: public' "$work/h" || fail "provinces: not publicly cacheable"
emit_rest "$f" "GET /provinces" GET /provinces -

# --- province-by-code.md --------------------------------------------------------------------------
f="$out/api/province-by-code.md"
begin "$f" "One wilaya with its communes (public)" "\`16\`, \`01\` or \`1\` (D3115); the answer names the two-digit code. Communes cut to three in the transcript."
rest GET /provinces/code/16 - - -; expect_status "province 16" 200
assert_js "Alger with communes" "b.code==='16' && b.towns.length>3 && b.towns.some((t)=>t.codeOns===$ALGER_CENTRE)" "$work/b"
cut_towns
emit_rest "$f" "GET /provinces/code/16" GET /provinces/code/16 -
rest GET /provinces/code/1 - - -; expect_status "province 1" 200
assert_js "two-digit code" "b.code==='01'" "$work/b"
cut_towns
emit_rest "$f" "GET /provinces/code/1: the answer names 01" GET /provinces/code/1 -
rest GET /provinces/code/70 - - -; expect_rest_code "province 70" 404 geo.province-not-found
emit_rest "$f" "GET /provinces/code/70: 404" GET /provinces/code/70 -

# --- fee-group-create.md --------------------------------------------------------------------------
f="$out/api/fee-group-create.md"
begin "$f" "Create a pricing option" "A new fee group of the active store (store from the session, never the body); \`delivery.pricing.create\`. Every wilaya's row is given; prices are whole DZD."
body=$(group_body 'خيار التسعير للأدلة' 650)
rest POST /delivery-fees "$body" "$owner" "$demo"; expect_status "create group" 201
assert_js "created" "b.name==='خيار التسعير للأدلة' && b.rates.length===69 && b.isPlatformDefault===false" "$work/b"
pricing_group=$(js 'b.id' "$work/b"); remember_id GROUP_EVIDENCE "$pricing_group"
command cp "$work/b" "$work/created.json"
cut_rates
emit_rest "$f" "POST /delivery-fees" POST /delivery-fees "$(shown_group "$body")"
Q="mutation (\$input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: \$input) { $PRICING_FIELDS } }"
body=$(group_body 'خيار احتياطي' 700)
gql "$Q" "{\"input\":$body}" "$owner" "$demo"; expect_ok "createDeliveryFeeGroup"
spare_group=$(js 'b.data.createDeliveryFeeGroup.id' "$work/b"); remember_id GROUP_SPARE "$spare_group"
emit "$f" "createDeliveryFeeGroup" "$Q" "{\"input\":$(shown_group "$body")}" "$owner" "$demo"

# --- fee-group-list.md ----------------------------------------------------------------------------
f="$out/api/fee-group-list.md"
begin "$f" "List pricing options" "The active store's groups, newest first, with the seeded \"Platform default prices\" table (D3112); \`delivery.pricing.view\`."
rest GET /delivery-fees - "$owner" "$demo"; expect_status "list groups" 200
assert_js "three groups" "b.totalItems===3 && b.items.some((g)=>g.isPlatformDefault) && b.items.some((g)=>g.id==='$pricing_group')" "$work/b"
platform_default=$(js 'b.items.find((g)=>g.isPlatformDefault).id' "$work/b"); remember_id GROUP_PLATFORM_DEFAULT "$platform_default"
emit_rest "$f" "GET /delivery-fees" GET /delivery-fees -
Q='query { deliveryFeeGroups(options: { search: "التسعير" }) { items { id name isPlatformDefault } totalItems } }'
gql "$Q" '{}' "$owner" "$demo"; expect_ok deliveryFeeGroups
assert_js "search" "b.data.deliveryFeeGroups.totalItems===1" "$work/b"
emit "$f" "deliveryFeeGroups (search)" "$Q" '{}' "$owner" "$demo"

# --- fee-group-update.md --------------------------------------------------------------------------
f="$out/api/fee-group-update.md"
begin "$f" "Edit a pricing option" "Every row is sent; a price different from its base (the platform default table) is stored as an override (D3107). The option created at 650 everywhere is sent back at each wilaya's base price with Alger at 750: Alger is \`overridden\`, the wilayas at their base are not."
body=$(base_body 'خيار التسعير للأدلة' 750 "$work/created.json")
rest PUT "/delivery-fees/$pricing_group" "$body" "$owner" "$demo"; expect_status "update group" 200
assert_js "Alger overridden" "b.rates.find((r)=>r.provinceCode==='16').homePrice===750 && b.rates.find((r)=>r.provinceCode==='16').overridden===true && b.rates.find((r)=>r.provinceCode==='01').overridden===false" "$work/b"
cut_rates
emit_rest "$f" "PUT /delivery-fees/:id (Alger home 750)" PUT "/delivery-fees/$pricing_group" "$(shown_group "$body")"
Q="mutation (\$id: String!, \$input: DeliveryFeeGroupInput!) { updateDeliveryFeeGroup(id: \$id, input: \$input) { $PRICING_FIELDS } }"
gql "$Q" "{\"id\":\"$pricing_group\",\"input\":$body}" "$owner" "$demo"; expect_ok updateDeliveryFeeGroup
emit "$f" "updateDeliveryFeeGroup" "$Q" "{\"id\":\"$pricing_group\",\"input\":$(shown_group "$body")}" "$owner" "$demo"

# --- fee-group-communes.md ------------------------------------------------------------------------
f="$out/api/fee-group-communes.md"
begin "$f" "Commune overrides" "One wilaya's communes in one call (D3125): Alger-Centre home 777, Casbah home delivery off; \`null\` inherits the wilaya."
body=$(communes_body)
rest PUT "/delivery-fees/$pricing_group/communes/16" "$body" "$owner" "$demo"; expect_status "communes" 200
assert_js "two commune rows" "b.communeRates.length===2 && b.communeRates.find((c)=>c.codeOns===$ALGER_CENTRE).homePrice===777" "$work/b"
cut_rates
emit_rest "$f" "PUT /delivery-fees/:id/communes/16" PUT "/delivery-fees/$pricing_group/communes/16" "$body"
Q='mutation ($groupId: String!, $rows: [DeliveryFeeCommuneRateInput!]!) { setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: "16", rows: $rows) { id communeRates { codeOns homePrice deliveryEnabled overridden } } }'
rows=$(B="$body" node -e 'console.log(JSON.stringify(JSON.parse(process.env.B).rows))')
gql "$Q" "{\"groupId\":\"$pricing_group\",\"rows\":$rows}" "$owner" "$demo"; expect_ok setDeliveryFeeCommuneRates
emit "$f" "setDeliveryFeeCommuneRates" "$Q" "{\"groupId\":\"$pricing_group\",\"rows\":$rows}" "$owner" "$demo"

# --- fee-group-read.md ----------------------------------------------------------------------------
f="$out/api/fee-group-read.md"
begin "$f" "Read a pricing option" "The group with its wilaya rows (cut to three here) and its commune overrides; \`delivery.pricing.view\`."
rest GET "/delivery-fees/$pricing_group" - "$owner" "$demo"; expect_status "read group" 200
assert_js "read" "b.rates.length===69 && b.communeRates.length===2" "$work/b"
cut_rates
emit_rest "$f" "GET /delivery-fees/:id" GET "/delivery-fees/$pricing_group" -
Q="query (\$id: String!) { deliveryFeeGroup(id: \$id) { $GROUP_FIELDS } }"
gql "$Q" "{\"id\":\"$pricing_group\"}" "$owner" "$demo"; expect_ok deliveryFeeGroup
cut_rates
emit "$f" "deliveryFeeGroup(id)" "$Q" "{\"id\":\"$pricing_group\"}" "$owner" "$demo"

# --- update-store-default-fee-group.md ------------------------------------------------------------
f="$out/api/update-store-default-fee-group.md"
begin "$f" "Store default pricing option" "\`updateStore\` links one of the store's own groups as its default (#207); tenancy asks delivery pricing whether the group is the store's (D3111)."
Q='mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId } }'
gql "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultDeliveryFeeGroupId\":\"$pricing_group\"}}" "$owner" "$demo"; expect_ok "link own group"
assert_js "linked" "b.data.updateStore.defaultDeliveryFeeGroupId==='$pricing_group'" "$work/b"
emit "$f" "updateStore(defaultDeliveryFeeGroupId: own group)" "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultDeliveryFeeGroupId\":\"$pricing_group\"}}" "$owner" "$demo"

# --- fee-group-delete.md --------------------------------------------------------------------------
f="$out/api/fee-group-delete.md"
begin "$f" "Delete a pricing option" "A group that is no store's default deletes; the store's default and its platform table are refused with 409 \`delivery-pricing.group-in-use\` (D3108)."
rest DELETE "/delivery-fees/$platform_default" - "$owner" "$demo"; expect_rest_code "delete platform default" 409 delivery-pricing.group-in-use
emit_rest "$f" "DELETE /delivery-fees/:id (the platform table): 409" DELETE "/delivery-fees/$platform_default" -
rest DELETE "/delivery-fees/$pricing_group" - "$owner" "$demo"; expect_rest_code "delete default" 409 delivery-pricing.group-in-use
emit_rest "$f" "DELETE /delivery-fees/:id (the store default): 409" DELETE "/delivery-fees/$pricing_group" -
rest DELETE "/delivery-fees/$spare_group" - "$owner" "$demo"; expect_status "delete spare" 200
emit_rest "$f" "DELETE /delivery-fees/:id (a spare group)" DELETE "/delivery-fees/$spare_group" -
Q='mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }'
gql "$Q" "{\"id\":\"$spare_group\"}" "$owner" "$demo"; expect_code "delete again" delivery-pricing.not-found
emit "$f" "deleteDeliveryFeeGroup of the deleted group: not found" "$Q" "{\"id\":\"$spare_group\"}" "$owner" "$demo"

# --- store-provinces-narrowed.md ------------------------------------------------------------------
f="$out/api/store-provinces-narrowed.md"
begin "$f" "Wilaya as the store offers it (signed)" "For the storefront server only, signed (D112, D3106): Alger's communes narrowed by the store's default table, Casbah without home delivery. The signed \`x-store-id\` must name the queried store (D3135)."
path="/store/provinces/code/16?storeId=$demo_store"
signed_get "$path" "$demo_store"; expect_status "narrowed" 200
assert_js "Casbah off" "b.code==='16' && b.towns.find((t)=>t.codeOns===$CASBAH).isHomeDelivery===false" "$work/b"
cut_towns
emit_signed "$f" "GET /store/provinces/code/16?storeId=<demo>" "$path"
path="/store/provinces/code/16?storeId=$second_store"
signed_get "$path" "$demo_store"; expect_rest_code "foreign store under demo's header" 404 geo.store-not-found
emit_signed "$f" "GET /store/provinces/code/16?storeId=<second> signed for <demo>: 404" "$path"
rest GET "/store/provinces/code/16?storeId=$demo_store" - - -; expect_status "unsigned" 404
emit_rest "$f" "GET /store/provinces/code/16 unsigned: 404, empty body (D112)" GET "/store/provinces/code/16?storeId=$demo_store" -

# --- isolation-b-group-from-a.md ------------------------------------------------------------------
f="$out/api/isolation-b-group-from-a.md"
begin "$f" "Business B's pricing option from business A" "A's owner names B's group id: 404 \`delivery-pricing.not-found\` on every route, \`null\` on the read (ADR 0002), B's group unchanged."
rest GET /delivery-fees - "$second_owner" "$second"; expect_status "B list" 200
b_group=$(js 'b.items.find((g)=>g.isPlatformDefault).id' "$work/b"); remember_id GROUP_B_PLATFORM_DEFAULT "$b_group"
rest GET "/delivery-fees/$b_group" - "$owner" "$demo"; expect_rest_code "A reads B" 404 delivery-pricing.not-found
emit_rest "$f" "GET /delivery-fees/:id (B's group, A's session)" GET "/delivery-fees/$b_group" -
body=$(group_body 'Renamed by A' 1)
rest PUT "/delivery-fees/$b_group" "$body" "$owner" "$demo"; expect_rest_code "A edits B" 404 delivery-pricing.not-found
emit_rest "$f" "PUT /delivery-fees/:id (B's group)" PUT "/delivery-fees/$b_group" "$(shown_group "$body")"
rest PUT "/delivery-fees/$b_group/communes/16" "$(communes_body)" "$owner" "$demo"; expect_rest_code "A communes B" 404 delivery-pricing.not-found
emit_rest "$f" "PUT /delivery-fees/:id/communes/16 (B's group)" PUT "/delivery-fees/$b_group/communes/16" "$(communes_body)"
Q='query ($id: String!) { deliveryFeeGroup(id: $id) { id name } }'
gql "$Q" "{\"id\":\"$b_group\"}" "$owner" "$demo"; expect_ok "A reads B (graphql)"
assert_js "null" 'b.data.deliveryFeeGroup===null' "$work/b"
emit "$f" "deliveryFeeGroup(id: B's group)" "$Q" "{\"id\":\"$b_group\"}" "$owner" "$demo"
rest GET "/delivery-fees/$b_group" - "$second_owner" "$second"; expect_status "B unchanged" 200
assert_js "B unchanged" "b.name!=='Renamed by A' && b.communeRates.length===0" "$work/b"

# --- update-store-refused-references.md -----------------------------------------------------------
f="$out/api/update-store-refused-references.md"
begin "$f" "Store links refused (#230, #153)" "\`updateStore\` naming B's group, or any carrier id before P5.S1 (D3109), answers the one pinned code \`tenancy.store-reference-not-found\` (D3111); the store keeps its default."
Q='mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId } }'
gql "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultDeliveryFeeGroupId\":\"$b_group\"}}" "$owner" "$demo"; expect_code "foreign group" tenancy.store-reference-not-found
emit "$f" "updateStore(defaultDeliveryFeeGroupId: B's group)" "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultDeliveryFeeGroupId\":\"$b_group\"}}" "$owner" "$demo"
gql "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultCarrierId\":\"1234567890123456789\"}}" "$owner" "$demo"; expect_code "carrier" tenancy.store-reference-not-found
emit "$f" "updateStore(defaultCarrierId: any id)" "$Q" "{\"id\":\"$demo_store\",\"input\":{\"defaultCarrierId\":\"1234567890123456789\"}}" "$owner" "$demo"
Q2='query ($id: String!) { store(id: $id) { id defaultDeliveryFeeGroupId } }'
gql "$Q2" "{\"id\":\"$demo_store\"}" "$owner" "$demo"; expect_ok "store default"
assert_js "kept" "b.data.store.defaultDeliveryFeeGroupId==='$pricing_group'" "$work/b"
emit "$f" "store(id): the default is unchanged" "$Q2" "{\"id\":\"$demo_store\"}" "$owner" "$demo"
