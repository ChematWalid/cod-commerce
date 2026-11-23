# Two storefront instances on one Valkey

Instance A is the compose `storefront` service (host port 23001); instance B is a second container of the same service and image (`docker compose run`, host port 23002), with the same environment and the same Valkey. The worker is stopped for the check, so the only revalidation is the one the script sends. Each row is one request by the script, in order: `GET /product/<slug of سروال قطني للأدلة>` with `Host: demo.localhost` for the page rows. Times are curl's `time_total` on this host; "Valkey entries" counts the `next:0822892c:*` keys after the request.

Between rows 2 and 3 the product is renamed to "سروال قطني للأدلة (اسم جديد)" over the Admin API (`updateCatalogProduct`); row 5 sends `{"tags":["store:<STORE_DEMO>"]}` to A only.

| Step | HTTP | ms | Name shown | Valkey entries |
| --- | --- | --- | --- | --- |
| 1. A renders the page (never requested before) | 200 | 122 | old | 52 |
| 2. B, same page | 200 | 351 | old | 52 |
| 3. B, after the rename in the catalog (no revalidation yet) | 200 | 63 | old | 52 |
| 4. A, after the rename (no revalidation yet) | 200 | 40 | old | 52 |
| 5. Signed `POST /api/internal/revalidate` on **A** (`store:<STORE_DEMO>`) | 200 | 12 | - | 52 |
| 6.1 B polls the page | 200 | 174 | new | 52 |
| 7. A, same page | 200 | 35 | new | 52 |

## Result

- Valkey entries before the first render: 49; after A rendered the page: 52. B answered the page from them: after the rename it still showed the old name (a fresh render would have shown the new one), and so did A.
- The signed revalidation on A answered 200 in 12 ms. B showed the new name after 1 poll(s), **419 ms** after the revalidation was sent (budget 1000 ms, asserted by the script).
