# shellcheck shell=bash
# Part 2 of the API evidence of scripts/evidence/P3.S1.sh (D3140, D3142, D3143), sourced by it after P3.S1-api.sh:
# "Raise/lower by...", "Set price for all communes", "Copy", the CSV export and the CSV import (REST and GraphQL), and
# the refusal of every one of them on another business's option. They run on a copy of the evidence option, so the
# option the quote and the screens use keeps its prices. Uses the driver's helpers and the variables of P3.S1-api.sh
# (pricing_group, b_group); sets copy_group and screens_csv (the file the CSV import screen chooses).

COPY_NAME='نسخة من خيار التسعير'
# The wilayas a transcript keeps of the 69 (and three communes): the ones these calls touch.
SHOWN_WILAYAS='["01","02","05","06","07","16"]'

cut_big() { # keeps an answer short: the rows of a few wilayas and three communes (the real answer holds all 69 rates)
  SHOWN="$SHOWN_WILAYAS" node -e '
const fs = require("fs"); const f = process.argv[1]; const t = fs.readFileSync(f, "utf8");
let b; try { b = JSON.parse(t); } catch { process.exit(0); }
const keep = new Set(JSON.parse(process.env.SHOWN));
const walk = (o) => {
  if (Array.isArray(o)) { o.forEach(walk); return; }
  if (o === null || typeof o !== "object") return;
  if (Array.isArray(o.rates) && o.rates.length === 69) { o.rates = o.rates.filter((r) => keep.has(r.provinceCode)); o.ratesShown = `${o.rates.length} of 69`; }
  if (Array.isArray(o.communeRates) && o.communeRates.length > 3) { const n = o.communeRates.length; o.communeRates = o.communeRates.slice(0, 3); o.communeRatesShown = `3 of ${n}`; }
  Object.values(o).forEach(walk);
};
walk(b); fs.writeFileSync(f, JSON.stringify(b));' "$work/b"
}
cut_csv_text() { # cut_csv_text <file>: the header, the first rows, Alger and its first commune; a note counts the rest
  node -e '
const fs = require("fs"); const f = process.argv[1]; const t = fs.readFileSync(f, "utf8");
const lines = t.replace(/\r?\n$/, "").split(/\r?\n/);
const keep = lines.filter((l, i) => i < 4 || l.startsWith("wilaya,16,") || l.startsWith("commune,16,1601,") || l.startsWith("commune,16,1607,"));
keep.push(`… ${keep.length} of ${lines.length} lines shown`);
fs.writeFileSync(f, keep.join("\r\n") + "\r\n");' "$1"
}
cut_csv_json() { # the CSV text inside a GraphQL answer
  node -e '
const fs = require("fs"); const f = process.argv[1]; const b = JSON.parse(fs.readFileSync(f, "utf8"));
const g = b.data && b.data.deliveryFeeGroupCsv; if (!g) process.exit(0);
const lines = g.content.replace(/\r?\n$/, "").split(/\r?\n/);
const keep = lines.filter((l, i) => i < 4 || l.startsWith("wilaya,16,") || l.startsWith("commune,16,1601,"));
g.content = keep.join("\r\n") + `\r\n… ${keep.length} of ${lines.length} lines shown`;
fs.writeFileSync(f, JSON.stringify(b));' "$work/b"
}
edit_csv() { # edit_csv <in> <out> <edit>...: sets a cell; an edit is <level>,<province>,<codeOns|-> then <column>=<value>
  IN="$1" OUT="$2" EDITS="$(shift 2; printf '%s;' "$@")" node -e '
const fs = require("fs"); const e = process.env;
const text = fs.readFileSync(e.IN, "utf8"); const bom = text.startsWith("﻿") ? "﻿" : "";
const lines = text.slice(bom.length).replace(/\r?\n$/, "").split(/\r?\n/);
const head = lines[0].split(","); let hit = 0;
for (const edit of e.EDITS.split(";").filter(Boolean)) {
  const [key, change] = edit.split(" "); const [level, province, ons] = key.split(","); const [col, value] = change.split("=");
  const i = lines.findIndex((l, n) => n > 0 && l.split(",").slice(0, 3).join(",") === [level, province, ons === "-" ? "" : ons].join(","));
  if (i < 0) throw new Error(`no CSV row ${key}`);
  const cells = lines[i].split(","); cells[head.indexOf(col)] = value; lines[i] = cells.join(","); hit += 1;
}
fs.writeFileSync(e.OUT, bom + lines.join("\r\n") + "\r\n");' "$1" "$2"
}
rest_csv() { # rest_csv <method> <path> <file> <content-type> <session> <channel> -> $status, $work/h, $work/b
  local -a args=(-sS -X "$1" -D "$work/h" -o "$work/b" --max-time 30 -H "Content-Type: $4" --data-binary "@$3"
    -H "Authorization: Bearer $5" -H "vendure-token: $6")
  LAST_SESSION=$5 LAST_CHANNEL=$6
  status=$(curl "${args[@]}" -w '%{http_code}' "$api$2") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api$2"
}
emit_rest_csv() { # emit_rest_csv <file> <title> <method> <shown-path> <shown-body> <content-type>
  SHOWN_HEADERS=$(shown_headers "$LAST_SESSION" "$LAST_CHANNEL" "Content-Type: $6") SHOWN_BODY=$5 TITLE=$2 METHOD=$3 URL="$api$4" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
shown_csv() { # shown_csv <file> <row-prefix>...: the header, the rows that differ, and a count of the rest
  F="$1" PREFIXES="$(shift; printf '%s;' "$@")" node -e '
const fs = require("fs"); const e = process.env;
const lines = fs.readFileSync(e.F, "utf8").replace(/^﻿/, "").replace(/\r?\n$/, "").split(/\r?\n/);
const shown = lines.filter((l, i) => i === 0 || e.PREFIXES.split(";").filter(Boolean).some((p) => l.startsWith(p)));
console.log(shown.join("\n") + `\n… ${shown.length} of ${lines.length} lines shown`);' 
}
MULTIPART_MAP='{"0":["variables.file"]}'
Q_IMPORT='mutation ($groupId: String!, $file: Upload!, $dryRun: Boolean!) { importDeliveryFeeGroupCsv(groupId: $groupId, file: $file, dryRun: $dryRun) { dryRun applied rows totalIssues issues { row column issue } changes { level provinceCode codeOns before { homePrice deskPrice deliveryEnabled deskEnabled } after { homePrice deskPrice deliveryEnabled deskEnabled } } group { id name } } }'
upload() { # upload <query> <group-id> <dry-run> <file> <session> <channel> -> $status, $work/h, $work/b (graphql-multipart-request-spec)
  local operations
  operations=$(Q="$1" G="$2" D="$3" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{groupId:process.env.G,file:null,dryRun:process.env.D==="true"}}))')
  status=$(curl -sS -X POST -D "$work/h" -o "$work/b" --max-time 60 -H "Authorization: Bearer $5" -H "vendure-token: $6" \
    -H 'apollo-require-preflight: true' -F "operations=$operations" -F "map=$MULTIPART_MAP" \
    -F "0=@$4;type=text/csv;filename=pricing.csv" -w '%{http_code}' "$api/admin-api?languageCode=en") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api (upload)"
}
emit_upload() { # emit_upload <file> <title> <group-id> <dry-run> <file-description>
  local operations
  operations=$(Q="$Q_IMPORT" G="$3" D="$4" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{groupId:process.env.G,file:null,dryRun:process.env.D==="true"}}))')
  SHOWN_HEADERS=$(printf '%s\n' 'Content-Type: multipart/form-data; boundary=[…]' 'Authorization: Bearer [REDACTED]' \
    'vendure-token: [REDACTED]' 'apollo-require-preflight: true') \
    SHOWN_BODY=$(printf 'operations: %s\nmap: %s\n0: %s' "$operations" "$MULTIPART_MAP" "$5") \
    TITLE=$2 METHOD=POST URL="$api/admin-api?languageCode=en" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}

# --- fee-group-duplicate.md -----------------------------------------------------------------------
f="$out/api/fee-group-duplicate.md"
begin "$f" "Copy a pricing option" "A new option of the same store with the source's settings, wilaya rows (base prices, overrides, switches) and commune rows, under the given name (D3140); \`delivery.pricing.create\` and \`view\` (D3143), 201. It is never a platform default. Rows are cut as in the other transcripts."
rest POST "/delivery-fees/$pricing_group/duplicate" "{\"name\":\"$COPY_NAME\"}" "$owner" "$demo"; expect_status "duplicate" 201
assert_js "the copy" "b.id!=='$pricing_group' && b.name==='$COPY_NAME' && b.isPlatformDefault===false && b.rates.length===69 && b.communeRates.length===2 && b.rates.find((r)=>r.provinceCode==='16').homePrice===750" "$work/b"
copy_group=$(js 'b.id' "$work/b"); remember_id GROUP_COPY "$copy_group"
cut_big
emit_rest "$f" "POST /delivery-fees/:id/duplicate" POST "/delivery-fees/$pricing_group/duplicate" "{\"name\":\"$COPY_NAME\"}"
Q="mutation (\$groupId: String!, \$name: String!) { duplicateDeliveryFeeGroup(groupId: \$groupId, name: \$name) { $PRICING_FIELDS } }"
gql "$Q" "{\"groupId\":\"$pricing_group\",\"name\":\"Second copy\"}" "$owner" "$demo"; expect_ok duplicateDeliveryFeeGroup
extra_copy=$(js 'b.data.duplicateDeliveryFeeGroup.id' "$work/b"); remember_id GROUP_COPY_SECOND "$extra_copy"
emit "$f" "duplicateDeliveryFeeGroup" "$Q" "{\"groupId\":\"$pricing_group\",\"name\":\"Second copy\"}" "$owner" "$demo"
rest DELETE "/delivery-fees/$extra_copy" - "$owner" "$demo"; expect_status "delete the second copy" 200
rest POST "/delivery-fees/$pricing_group/duplicate" '{"name":""}' "$owner" "$demo"; expect_rest_code "empty name" 400 delivery-pricing.invalid-input
emit_rest "$f" "POST /delivery-fees/:id/duplicate with an empty name: 400" POST "/delivery-fees/$pricing_group/duplicate" '{"name":""}'

# --- fee-group-adjust.md --------------------------------------------------------------------------
f="$out/api/fee-group-adjust.md"
begin "$f" "Raise or lower the selected wilayas' prices" "\"Raise/lower by...\" (D3140): by whole DZD or a whole percent (rounded half up, ADR 0004), on the home and/or desk price of the listed wilayas, stored as overrides of the kept base (D3107). Run on the copy: Adrar (01) and Alger (16) +100 DZD home, then Chlef (02) +10% home and desk. \`delivery.pricing.edit\`."
body='{"provinceCodes":["01","16"],"kind":"amount","value":100,"home":true,"desk":false,"includeCommunes":false}'
rest POST "/delivery-fees/$copy_group/adjust" "$body" "$owner" "$demo"; expect_status "adjust amount" 200
assert_js "amount" "(()=>{const r=(c)=>b.rates.find((x)=>x.provinceCode===c); return r('01').homePrice===r('01').baseHomePrice+100 && r('01').overridden===true && r('01').deskPrice===r('01').baseDeskPrice && r('16').homePrice===850 && r('02').overridden===false})()" "$work/b"
cut_big
emit_rest "$f" "POST /delivery-fees/:id/adjust (+100 DZD home)" POST "/delivery-fees/$copy_group/adjust" "$body"
Q="mutation (\$groupId: String!, \$input: DeliveryFeePriceAdjustmentInput!) { adjustDeliveryFeeGroupPrices(groupId: \$groupId, input: \$input) { $GROUP_FIELDS } }"
vars_adjust="{\"groupId\":\"$copy_group\",\"input\":{\"provinceCodes\":[\"02\"],\"kind\":\"percent\",\"value\":10,\"home\":true,\"desk\":true}}"
gql "$Q" "$vars_adjust" "$owner" "$demo"; expect_ok adjustDeliveryFeeGroupPrices
assert_js "percent" "(()=>{const r=b.data.adjustDeliveryFeeGroupPrices.rates.find((x)=>x.provinceCode==='02'); return r.homePrice===Math.round(r.baseHomePrice*1.1) && r.deskPrice===Math.round(r.baseDeskPrice*1.1) && r.overridden===true})()" "$work/b"
cut_big
emit "$f" "adjustDeliveryFeeGroupPrices (+10% home and desk)" "$Q" "$vars_adjust" "$owner" "$demo"
rest POST "/delivery-fees/$copy_group/adjust" '{"provinceCodes":[],"kind":"amount","value":100,"home":true,"desk":false}' "$owner" "$demo"; expect_rest_code "no wilaya" 400 delivery-pricing.invalid-input
emit_rest "$f" "POST /delivery-fees/:id/adjust with no wilaya: 400" POST "/delivery-fees/$copy_group/adjust" '{"provinceCodes":[],"kind":"amount","value":100,"home":true,"desk":false}'

# --- fee-group-commune-prices.md ------------------------------------------------------------------
f="$out/api/fee-group-commune-prices.md"
begin "$f" "One price for every commune of a wilaya" "\"Set price for all communes\" (D3140): a number becomes every commune's price, an absent price is left as stored, \`null\` clears the overrides. Run on the copy, on Alger (16); \`delivery.pricing.edit\`. Communes are cut to three."
body='{"homePrice":500,"deskPrice":300}'
rest PUT "/delivery-fees/$copy_group/communes/16/prices" "$body" "$owner" "$demo"; expect_status "commune prices" 200
assert_js "every commune" "(()=>{const c=b.communeRates.filter((x)=>x.provinceCode==='16'); return c.length>3 && c.every((x)=>x.homePrice===500)})()" "$work/b"
cut_big
emit_rest "$f" "PUT /delivery-fees/:id/communes/16/prices" PUT "/delivery-fees/$copy_group/communes/16/prices" "$body"
Q='mutation ($groupId: String!, $input: DeliveryFeeCommunePricesInput!) { setDeliveryFeeProvinceCommunePrices(groupId: $groupId, provinceCode: "16", input: $input) { id communeRates { codeOns provinceCode homePrice deskPrice deliveryEnabled overridden } } }'
gql "$Q" "{\"groupId\":\"$copy_group\",\"input\":{\"homePrice\":520}}" "$owner" "$demo"; expect_ok setDeliveryFeeProvinceCommunePrices
assert_js "520 everywhere" "b.data.setDeliveryFeeProvinceCommunePrices.communeRates.every((x)=>x.homePrice===520)" "$work/b"
cut_big
emit "$f" "setDeliveryFeeProvinceCommunePrices (home 520, desk as stored)" "$Q" "{\"groupId\":\"$copy_group\",\"input\":{\"homePrice\":520}}" "$owner" "$demo"
rest PUT "/delivery-fees/$copy_group/communes/16/prices" '{}' "$owner" "$demo"; expect_rest_code "no price" 400 delivery-pricing.invalid-input
emit_rest "$f" "PUT /delivery-fees/:id/communes/16/prices with no price: 400" PUT "/delivery-fees/$copy_group/communes/16/prices" '{}'

# --- fee-group-csv-export.md ----------------------------------------------------------------------
f="$out/api/fee-group-csv-export.md"
begin "$f" "Export a pricing option as CSV" "One row per wilaya in code order, each followed by its stored commune rows, with effective prices; an empty commune cell inherits the wilaya (D3142). UTF-8 with a byte order mark so Excel opens it; the file name carries the option id only. \`delivery.pricing.view\`. The transcript keeps the first rows, Alger and its first commune; the real file is all of them."
rest GET "/delivery-fees/$copy_group/export" - "$owner" "$demo"; expect_status "export" 200
command grep -qi '^content-type: text/csv; charset=utf-8' "$work/h" || fail "export: not text/csv"
command grep -qi '^content-disposition: attachment; filename="' "$work/h" || fail "export: no attachment name"
command cp "$work/b" "$work/copy-export.csv"
node -e 'const t=require("fs").readFileSync(process.argv[1]); const s=t.toString("utf8"); if (!(t[0]===0xef && t[1]===0xbb && t[2]===0xbf && s.slice(1,40).startsWith("level,provinceCode,codeOns,homePrice,deskPrice,deliveryEnabled,deskEnabled") && s.split(/\r?\n/).length>100)) process.exit(1)' "$work/copy-export.csv" || fail "export: not the expected CSV"
cut_csv_text "$work/b"
emit_rest "$f" "GET /delivery-fees/:id/export" GET "/delivery-fees/$copy_group/export" -
Q='query ($id: String!) { deliveryFeeGroupCsv(id: $id) { fileName content } }'
gql "$Q" "{\"id\":\"$copy_group\"}" "$owner" "$demo"; expect_ok deliveryFeeGroupCsv
assert_js "same file" "b.data.deliveryFeeGroupCsv.content.length>1000 && b.data.deliveryFeeGroupCsv.content.includes('commune,16,$ALGER_CENTRE,520,')" "$work/b"
cut_csv_json
emit "$f" "deliveryFeeGroupCsv(id)" "$Q" "{\"id\":\"$copy_group\"}" "$owner" "$demo"

# --- fee-group-csv-import.md ----------------------------------------------------------------------
f="$out/api/fee-group-csv-import.md"
begin "$f" "Import a CSV into a pricing option" "A dry run (the default) lists what the file would change and the rows it refuses and writes nothing; the apply writes it in one go and only when no row is refused (D3142). REST takes the raw body with \`Content-Type: text/csv\` (any other type is refused before the body is read, D3143); GraphQL takes a multipart \`Upload\`. Run on the copy with the export edited in three rows: Batna (05) home 880, Biskra (06) delivery off, Alger-Centre home 650. \`delivery.pricing.edit\`."
import_one="$work/import-one.csv"
edit_csv "$work/copy-export.csv" "$import_one" "wilaya,05,- homePrice=880" "wilaya,06,- deliveryEnabled=false" "commune,16,$ALGER_CENTRE homePrice=650"
shown=$(shown_csv "$import_one" 'wilaya,05,' 'wilaya,06,' "commune,16,$ALGER_CENTRE,")
rest_csv POST "/delivery-fees/$copy_group/import?dryRun=true" "$import_one" text/csv "$owner" "$demo"; expect_status "dry run" 200
assert_js "three changes" "b.dryRun===true && b.applied===false && b.changes.length===3 && b.issues.length===0 && b.totalIssues===0 && b.group===null" "$work/b"
emit_rest_csv "$f" "POST /delivery-fees/:id/import?dryRun=true (the file's changed rows shown)" POST "/delivery-fees/$copy_group/import?dryRun=true" "$shown" text/csv
rest GET "/delivery-fees/$copy_group" - "$owner" "$demo"; expect_status "read after dry run" 200
assert_js "dry run wrote nothing" "b.rates.find((r)=>r.provinceCode==='05').homePrice!==880" "$work/b"
rest_csv POST "/delivery-fees/$copy_group/import?dryRun=false" "$import_one" text/csv "$owner" "$demo"; expect_status "apply" 200
assert_js "applied" "b.dryRun===false && b.applied===true && b.changes.length===3 && b.group.rates.find((r)=>r.provinceCode==='05').homePrice===880 && b.group.rates.find((r)=>r.provinceCode==='06').deliveryEnabled===false" "$work/b"
cut_big
emit_rest_csv "$f" "POST /delivery-fees/:id/import?dryRun=false (the same file)" POST "/delivery-fees/$copy_group/import?dryRun=false" "$shown" text/csv
rest_csv POST "/delivery-fees/$copy_group/import?dryRun=true" "$import_one" text/plain "$owner" "$demo"; expect_rest_code "text/plain" 400 delivery-pricing.csv-invalid-file
emit_rest_csv "$f" "POST /delivery-fees/:id/import with Content-Type: text/plain: 400" POST "/delivery-fees/$copy_group/import?dryRun=true" "$shown" text/plain
import_two="$work/import-two.csv"
edit_csv "$import_one" "$import_two" "wilaya,07,- deskPrice=450"
shown=$(shown_csv "$import_two" 'wilaya,07,')
upload "$Q_IMPORT" "$copy_group" true "$import_two" "$owner" "$demo"; expect_status "graphql dry run" 200; expect_ok "importDeliveryFeeGroupCsv dry run"
assert_js "one change" "b.data.importDeliveryFeeGroupCsv.dryRun===true && b.data.importDeliveryFeeGroupCsv.changes.length===1 && b.data.importDeliveryFeeGroupCsv.changes[0].provinceCode==='07'" "$work/b"
emit_upload "$f" "importDeliveryFeeGroupCsv (dryRun: true)" "$copy_group" true "pricing.csv (text/csv), the changed rows: $(printf '%s' "$shown" | command tr '\n' '|')"
upload "$Q_IMPORT" "$copy_group" false "$import_two" "$owner" "$demo"; expect_status "graphql apply" 200; expect_ok "importDeliveryFeeGroupCsv apply"
assert_js "applied" "b.data.importDeliveryFeeGroupCsv.applied===true && b.data.importDeliveryFeeGroupCsv.group.id==='$copy_group'" "$work/b"
emit_upload "$f" "importDeliveryFeeGroupCsv (dryRun: false)" "$copy_group" false "pricing.csv (text/csv), the same file"
bad_csv="$work/import-bad.csv"
edit_csv "$import_one" "$bad_csv" "wilaya,05,- homePrice=abc"
upload "$Q_IMPORT" "$copy_group" true "$bad_csv" "$owner" "$demo"; expect_ok "importDeliveryFeeGroupCsv with a refused row"
assert_js "refused row" "b.data.importDeliveryFeeGroupCsv.totalIssues===1 && b.data.importDeliveryFeeGroupCsv.issues[0].issue==='invalid-price' && b.data.importDeliveryFeeGroupCsv.issues[0].column==='homePrice'" "$work/b"
emit_upload "$f" "importDeliveryFeeGroupCsv (dryRun: true) with a refused row: listed, nothing quoted back" "$copy_group" true "pricing.csv (text/csv), Batna's homePrice is not a number"
upload "$Q_IMPORT" "$copy_group" false "$bad_csv" "$owner" "$demo"; expect_code "apply with a refused row" delivery-pricing.csv-invalid-rows
emit_upload "$f" "importDeliveryFeeGroupCsv (dryRun: false) with a refused row: refused, nothing written" "$copy_group" false "pricing.csv (text/csv), the same file"

# --- the file the CSV import screen chooses (the evidence option's own export, three rows edited) -------------------
rest GET "/delivery-fees/$pricing_group/export" - "$owner" "$demo"; expect_status "export of the evidence option" 200
command cp "$work/b" "$work/main-export.csv"
screens_csv="$work/screens-import.csv"
edit_csv "$work/main-export.csv" "$screens_csv" "wilaya,05,- homePrice=880" "wilaya,16,- homePrice=800" "commune,16,$ALGER_CENTRE homePrice=700"

# --- fee-group-bulk-isolation.md ------------------------------------------------------------------
f="$out/api/fee-group-bulk-isolation.md"
body='{"provinceCodes":["01"],"kind":"amount","value":100,"home":true,"desk":false}'
begin "$f" "Business B's pricing option on the new routes" "A's owner names B's option id on adjust, duplicate, export and import (REST), and on adjust (GraphQL): 404 \`delivery-pricing.not-found\` on each, nothing written, B's option and list unchanged (ADR 0002)."
rest POST "/delivery-fees/$b_group/adjust" "$body" "$owner" "$demo"; expect_rest_code "A adjusts B" 404 delivery-pricing.not-found
emit_rest "$f" "POST /delivery-fees/:id/adjust (B's option, A's session)" POST "/delivery-fees/$b_group/adjust" "$body"
rest POST "/delivery-fees/$b_group/duplicate" '{"name":"Stolen copy"}' "$owner" "$demo"; expect_rest_code "A copies B" 404 delivery-pricing.not-found
emit_rest "$f" "POST /delivery-fees/:id/duplicate (B's option)" POST "/delivery-fees/$b_group/duplicate" '{"name":"Stolen copy"}'
rest GET "/delivery-fees/$b_group/export" - "$owner" "$demo"; expect_rest_code "A exports B" 404 delivery-pricing.not-found
emit_rest "$f" "GET /delivery-fees/:id/export (B's option)" GET "/delivery-fees/$b_group/export" -
rest_csv POST "/delivery-fees/$b_group/import?dryRun=false" "$import_one" text/csv "$owner" "$demo"; expect_rest_code "A imports into B" 404 delivery-pricing.not-found
emit_rest_csv "$f" "POST /delivery-fees/:id/import?dryRun=false (B's option)" POST "/delivery-fees/$b_group/import?dryRun=false" "$(shown_csv "$import_one" 'wilaya,05,')" text/csv
Q_ADJ="mutation (\$groupId: String!, \$input: DeliveryFeePriceAdjustmentInput!) { adjustDeliveryFeeGroupPrices(groupId: \$groupId, input: \$input) { id } }"
vars_b="{\"groupId\":\"$b_group\",\"input\":{\"provinceCodes\":[\"01\"],\"kind\":\"amount\",\"value\":100,\"home\":true,\"desk\":false}}"
gql "$Q_ADJ" "$vars_b" "$owner" "$demo"; expect_code "A adjusts B (graphql)" delivery-pricing.not-found
emit "$f" "adjustDeliveryFeeGroupPrices (B's option)" "$Q_ADJ" "$vars_b" "$owner" "$demo"
rest GET /delivery-fees - "$second_owner" "$second"; expect_status "B list" 200
assert_js "B has only its platform table" "b.totalItems===1 && b.items[0].isPlatformDefault===true" "$work/b"
rest GET "/delivery-fees/$b_group" - "$second_owner" "$second"; expect_status "B unchanged" 200
assert_js "B unchanged" "b.rates.every((r)=>r.overridden===false) && b.communeRates.length===0" "$work/b"
