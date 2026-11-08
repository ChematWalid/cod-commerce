# Storefront host routing

`GET /` on the storefront, the store chosen only by the `Host` header (the proxy rewrites to the internal `/_t/{storeId}/{locale}` route). Each body is trimmed by the script to the one element that identifies the page (the store heading or the not-found marker); the status and the absence of the other store's name are checked on the whole body.

### Host: demo.localhost

```http
GET http://127.0.0.1:23001/
Host: demo.localhost

HTTP/1.1 200 OK
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<h1 data-testid="store-name">Demo Store</h1>
```

### Host: second.localhost

```http
GET http://127.0.0.1:23001/
Host: second.localhost

HTTP/1.1 200 OK
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<h1 data-testid="store-name">Second Store</h1>
```

### Host: DEMO.localhost.:3001 (upper case, trailing dot and port: the same store)

```http
GET http://127.0.0.1:23001/
Host: DEMO.localhost.:3001

HTTP/1.1 200 OK
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<h1 data-testid="store-name">Demo Store</h1>
```

### Host: nope.localhost (unknown host)

```http
GET http://127.0.0.1:23001/
Host: nope.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<main data-testid="not-found">Page not found</main>
```

### Host: demo.localhost, path /_t/second/fr (internal path, not reachable directly)

```http
GET http://127.0.0.1:23001/_t/second/fr
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<main data-testid="not-found">Page not found</main>
```

### Host: demo.localhost, path /%5Ft/second/fr (the same internal path percent-encoded)

```http
GET http://127.0.0.1:23001/%5Ft/second/fr
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<main data-testid="not-found">Page not found</main>
```

### Host: nope.localhost with X-Forwarded-Host: demo.localhost (the forwarded header is ignored)

```http
GET http://127.0.0.1:23001/
Host: nope.localhost
X-Forwarded-Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<main data-testid="not-found">Page not found</main>
```

