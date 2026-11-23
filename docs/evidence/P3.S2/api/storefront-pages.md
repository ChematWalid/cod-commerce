# Storefront tenant pages

`GET` on the storefront (instance A), the store chosen only by the `Host` header. Each tenant page carries `cloudflare-cdn-cache-control` for the edge (ADR 0006 §4) and never a `set-cookie`; the tenant wrapper carries the store's `lang` and `dir`. Bodies are cut to the tenant wrapper and the store name.

### Host: demo.localhost, GET /

```http
GET http://127.0.0.1:23001/
Host: demo.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<div class="theme-root" data-page="home" lang="ar" dir="rtl" style="--color-primary:#0f766e;--color-text:#1f2937;--color-background:#ffffff;--radius:0.375rem;--font-family:&#x27;IBM Plex Sans Arabic&#x27;, ui-sans-serif, system-ui, sans-serif">
<a class="store-name" data-testid="store-name" href="/">Demo Store</a>
```

### Host: second.localhost, GET /

```http
GET http://127.0.0.1:23001/
Host: second.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<div class="theme-root" data-page="home" lang="fr" dir="ltr" style="--color-primary:#0f766e;--color-text:#1f2937;--color-background:#ffffff;--radius:0.375rem;--font-family:&#x27;IBM Plex Sans Arabic&#x27;, ui-sans-serif, system-ui, sans-serif">
<a class="store-name" data-testid="store-name" href="/">Second Store</a>
```

### Host: demo2.localhost, GET /

```http
GET http://127.0.0.1:23001/
Host: demo2.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<div class="theme-root" data-page="home" lang="en" dir="ltr" style="--color-primary:#0f766e;--color-text:#1f2937;--color-background:#ffffff;--radius:0.375rem;--font-family:&#x27;IBM Plex Sans Arabic&#x27;, ui-sans-serif, system-ui, sans-serif">
<a class="store-name" data-testid="store-name" href="/">Demo Store 2</a>
```

### Host: demo.localhost, GET /products

```http
GET http://127.0.0.1:23001/products
Host: demo.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<div class="theme-root" data-page="collection" lang="ar" dir="rtl" style="--color-primary:#0f766e;--color-text:#1f2937;--color-background:#ffffff;--radius:0.375rem;--font-family:&#x27;IBM Plex Sans Arabic&#x27;, ui-sans-serif, system-ui, sans-serif">
<a class="store-name" data-testid="store-name" href="/">Demo Store</a>
```

### Host: second.localhost, GET /products

```http
GET http://127.0.0.1:23001/products
Host: second.localhost

HTTP/1.1 200 OK
cloudflare-cdn-cache-control: max-age=60, stale-while-revalidate=600
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<div class="theme-root" data-page="collection" lang="fr" dir="ltr" style="--color-primary:#0f766e;--color-text:#1f2937;--color-background:#ffffff;--radius:0.375rem;--font-family:&#x27;IBM Plex Sans Arabic&#x27;, ui-sans-serif, system-ui, sans-serif">
<a class="store-name" data-testid="store-name" href="/">Second Store</a>
```

### Host: nope.localhost (no store): 404

```http
GET http://127.0.0.1:23001/
Host: nope.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
etag: "2g3q3v2plw4x5"
content-type: text/html; charset=utf-8

<main data-testid="not-found" class="stub-page">
```

### Host: nope.localhost with X-Forwarded-Host: demo.localhost: still 404 (the forwarded header is ignored)

```http
GET http://127.0.0.1:23001/
Host: nope.localhost
X-Forwarded-Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
etag: "2g3q3v2plw4x5"
content-type: text/html; charset=utf-8

<main data-testid="not-found" class="stub-page">
```

