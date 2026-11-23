# POST /api/internal/revalidate

The api's revalidate worker expires storefront cache tags here (D3211). Anything that is not a signed call answers an empty 404, as if the route did not exist; a signed malformed body answers an empty 400; a signed call answers 200.

### Unsigned: 404, empty

```http
POST http://127.0.0.1:23001/api/internal/revalidate
Host: demo.localhost
Content-Type: application/json

{
  "tags": [
    "store:<STORE_DEMO>"
  ]
}

HTTP/1.1 404 Not Found
cache-control: no-store
```

### Signed, a tag that is not a storefront cache tag: 400, empty

```http
POST http://127.0.0.1:23001/api/internal/revalidate
Host: demo.localhost
Content-Type: application/json
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

{
  "tags": [
    "not-a-tag"
  ]
}

HTTP/1.1 400 Bad Request
cache-control: no-store
```

### Signed: 200

```http
POST http://127.0.0.1:23001/api/internal/revalidate
Host: demo.localhost
Content-Type: application/json
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

{
  "tags": [
    "store:<STORE_DEMO>"
  ]
}

HTTP/1.1 200 OK
cache-control: no-store
```

