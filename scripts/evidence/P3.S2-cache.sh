# shellcheck shell=bash
# The two-instance check of scripts/evidence/P3.S2.sh (ADR 0006: Valkey is the only cache tier, shared by every instance),
# sourced by it after the screens. Starts instance B of the same storefront service on the same Valkey, stops the worker
# so nothing revalidates behind the script's back, then:
#   1. renders a product page never requested before on instance A, then requests it on B;
#   2. renames the product over the Admin API: both instances still answer the cached page (B serves A's entry);
#   3. sends one signed revalidation of the store's tag to A only and polls B until the new name shows, timing it.
# Afterwards it restores the name and the worker, and starts the compact-theme instance (its own Valkey database) for the
# compact screens. Writes $out/api/two-instances.md. Uses the driver's helpers and the API part's variables.

site_b="http://127.0.0.1:$STOREFRONT_B_HOST_PORT"
site_compact="http://127.0.0.1:$STOREFRONT_COMPACT_HOST_PORT"
# Upper bound for B to show the new name after the signed revalidation on A (acceptance criterion of P3.S2).
REFRESH_BUDGET_MS=1000
REFRESH_POLL_LIMIT=50

timeout 120 docker compose run -d --no-deps --name cod-evidence-storefront-b \
  -p "127.0.0.1:$STOREFRONT_B_HOST_PORT:3001" storefront >/dev/null
wait_http 200 "$site_b/livez" 120 || fail "instance B /livez"
# `docker compose ps storefront` now lists B too, so A is named by the container compose gave it.
[[ "$(docker inspect -f '{{.Image}}' cod-evidence-storefront-b)" == "$(docker inspect -f '{{.Image}}' cod-evidence-storefront-1)" ]] ||
  fail "instance B runs another image than A"

darija_slug=$(js "encodeURIComponent(b.items.find((p)=>p.name==='$DARIJA_TITLE').slug)" "$work/demo-list.json")
darija_id=$(js "b.items.find((p)=>p.name==='$DARIJA_TITLE').id" "$work/demo-list.json")
renamed_title="$DARIJA_TITLE (اسم جديد)"
page="/product/$darija_slug"
valkey_entries() { timeout 30 docker compose exec -T valkey valkey-cli --scan --pattern "next:$NEXT_DEPLOYMENT_ID:*" | command wc -l; }
now_ms() { date +%s%3N; }
rows=()
timed_get() { # timed_get <base-url> <label> -> $status, $work/b, $title_seen, $elapsed_ms; appends a table row
  local seconds
  seconds=$(curl -sS -o "$work/b" -H "Host: $DEMO_HOST" -w '%{time_total}' --max-time 60 "$1$page" -D "$work/h") || fail "$2: no answer"
  status=$(command awk 'NR==1{print $2}' "$work/h")
  elapsed_ms=$(command awk -v s="$seconds" 'BEGIN{printf "%d", s*1000}')
  if command grep -qF "$renamed_title" "$work/b"; then title_seen=new
  elif command grep -qF "$DARIJA_TITLE" "$work/b"; then title_seen=old
  else title_seen=none; fi
  rows+=("| $2 | $status | $elapsed_ms | $title_seen | $(valkey_entries) |")
}

timeout 120 docker compose stop worker >/dev/null
entries_before=$(valkey_entries)
timed_get "$site" "1. A renders the page (never requested before)"
[[ "$status" == 200 && "$title_seen" == old ]] || fail "A did not render $page ($status, $title_seen)"
entries_after_a=$(valkey_entries)
((entries_after_a > entries_before)) || fail "A wrote no cache entry ($entries_before -> $entries_after_a)"
timed_get "$site_b" "2. B, same page"
[[ "$status" == 200 && "$title_seen" == old ]] || fail "B did not serve $page ($status, $title_seen)"

gql "$Q_UPDATE_PRODUCT" "$(vars "{id:'$darija_id',input:{title:'$renamed_title'}}")" "$owner" "$demo"; expect_ok "rename"
timed_get "$site_b" "3. B, after the rename in the catalog (no revalidation yet)"
[[ "$title_seen" == old ]] || fail "B rendered fresh instead of serving the shared entry ($title_seen)"
timed_get "$site" "4. A, after the rename (no revalidation yet)"
[[ "$title_seen" == old ]] || fail "A rendered fresh instead of serving its entry ($title_seen)"

# The signature is made before the clock starts: signing takes seconds and is valid for 60.
sign_for POST /api/internal/revalidate - "$work/revalidate.json"
revalidate_args=("${SIGN_ARGS[@]}")
t0=$(now_ms)
revalidate_status=$(curl -sS -o /dev/null -X POST -H "Host: $DEMO_HOST" -H "$json" --data-binary "@$work/revalidate.json" \
  "${revalidate_args[@]}" -w '%{http_code}' --max-time 30 "$site/api/internal/revalidate") || fail "revalidate on A: no answer"
t_revalidated=$(now_ms)
[[ "$revalidate_status" == 200 ]] || fail "revalidate on A answered $revalidate_status"
rows+=("| 5. Signed \`POST /api/internal/revalidate\` on **A** (\`store:<STORE_DEMO>\`) | $revalidate_status | $((t_revalidated - t0)) | - | $(valkey_entries) |")
polls=0 refreshed_ms=''
while ((polls < REFRESH_POLL_LIMIT)); do
  polls=$((polls + 1))
  timed_get "$site_b" "6.$polls B polls the page"
  if [[ "$title_seen" == new ]]; then refreshed_ms=$(($(now_ms) - t0)); break; fi
done
[[ -n "$refreshed_ms" ]] || fail "B never showed the new name after $REFRESH_POLL_LIMIT polls"
((refreshed_ms < REFRESH_BUDGET_MS)) || fail "B showed the new name ${refreshed_ms} ms after the revalidation, over ${REFRESH_BUDGET_MS} ms"
timed_get "$site" "7. A, same page"
[[ "$title_seen" == new ]] || fail "A still shows the old name after the revalidation"

{
  printf '# Two storefront instances on one Valkey\n\n'
  printf 'Instance A is the compose `storefront` service (host port %s); instance B is a second container of the same service and image (`docker compose run`, host port %s), with the same environment and the same Valkey. The worker is stopped for the check, so the only revalidation is the one the script sends. Each row is one request by the script, in order: `GET %s` with `Host: %s` for the page rows. Times are curl'"'"'s `time_total` on this host; "Valkey entries" counts the `next:%s:*` keys after the request.\n\n' \
    "$STOREFRONT_HOST_PORT" "$STOREFRONT_B_HOST_PORT" "/product/<slug of $DARIJA_TITLE>" "$DEMO_HOST" "$NEXT_DEPLOYMENT_ID"
  printf 'Between rows 2 and 3 the product is renamed to "%s" over the Admin API (`updateCatalogProduct`); row 5 sends `{"tags":["store:<STORE_DEMO>"]}` to A only.\n\n' "$renamed_title"
  printf '| Step | HTTP | ms | Name shown | Valkey entries |\n| --- | --- | --- | --- | --- |\n'
  printf '%s\n' "${rows[@]}"
  printf '\n## Result\n\n'
  printf -- '- Valkey entries before the first render: %s; after A rendered the page: %s. B answered the page from them: after the rename it still showed the old name (a fresh render would have shown the new one), and so did A.\n' "$entries_before" "$entries_after_a"
  printf -- '- The signed revalidation on A answered 200 in %s ms. B showed the new name after %s poll(s), **%s ms** after the revalidation was sent (budget %s ms, asserted by the script).\n' \
    "$((t_revalidated - t0))" "$polls" "$refreshed_ms" "$REFRESH_BUDGET_MS"
} >"$out/api/two-instances.md"

# --- restore, then the compact-theme instance ------------------------------------------------------
gql "$Q_UPDATE_PRODUCT" "$(vars "{id:'$darija_id',input:{title:'$DARIJA_TITLE'}}")" "$owner" "$demo"; expect_ok "rename back"
timeout 120 docker compose start worker >/dev/null
docker rm -f cod-evidence-storefront-b >/dev/null
# Database 1 of the same Valkey: the compact theme's pages never mix with the default theme's entries.
timeout 120 docker compose run -d --no-deps --name cod-evidence-storefront-compact \
  -e STOREFRONT_THEME=compact -e REDIS_URL=redis://valkey:6379/1 \
  -p "127.0.0.1:$STOREFRONT_COMPACT_HOST_PORT:3001" storefront >/dev/null
wait_http 200 "$site_compact/livez" 120 || fail "compact instance /livez"
# The rename back reaches the projection through the worker; the compact home lists the original name.
deadline=$((SECONDS + PROJECTION_WAIT_SECONDS))
until api_get '/store/products?take=50' "$demo_store" && [[ "$(js "b.items.some((p)=>p.name==='$DARIJA_TITLE')" "$work/b")" == true ]]; do
  ((SECONDS < deadline)) || fail "the projection still lists the renamed product"
  sleep 4
done
