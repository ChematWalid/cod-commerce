# Storefront isolation

A buyer on the Arabic store's host can never reach the French store: the internal tenant path `/_t/{locale}/{storeId}/{binding}` is refused from outside (here with the French store's real host binding, D3202), and a product slug is looked up in the host's own store only.

### Host: demo.localhost, GET /_t/fr/<STORE_SECOND>/<BINDING_SECOND>: 404

```http
GET http://127.0.0.1:23001/_t/fr/<STORE_SECOND>/<BINDING_SECOND>
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
etag: "2g3q3v2plw4x5"
content-type: text/html; charset=utf-8

<main data-testid="not-found" class="stub-page">
```

### Host: demo.localhost, GET /%5Ft/fr/<STORE_SECOND>/<BINDING_SECOND>: 404

```http
GET http://127.0.0.1:23001/%5Ft/fr/<STORE_SECOND>/<BINDING_SECOND>
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
etag: "2g3q3v2plw4x5"
content-type: text/html; charset=utf-8

<main data-testid="not-found" class="stub-page">
```

### Host: demo.localhost, GET /_t/fr/<STORE_SECOND>/<BINDING_SECOND>/products: 404

```http
GET http://127.0.0.1:23001/_t/fr/<STORE_SECOND>/<BINDING_SECOND>/products
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
etag: "2g3q3v2plw4x5"
content-type: text/html; charset=utf-8

<main data-testid="not-found" class="stub-page">
```

### Host: second.localhost, GET /product/<the Arabic store's slug>: HTTP 200 with the 404 fallback and the not-found tree (a soft 404 under Cache Components, D3223 d), noindex, no Arabic product name anywhere in the body

```http
GET http://127.0.0.1:23001/product/%D9%88%D8%B3%D8%A7%D8%AF%D8%A9-%D9%85%D8%B7%D8%B1%D8%B2%D8%A9-%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A%D8%A9
Host: second.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

\"data-testid\":\"not-found\"
\"data-testid\":\"not-found\"
NEXT_HTTP_ERROR_FALLBACK;404
```

